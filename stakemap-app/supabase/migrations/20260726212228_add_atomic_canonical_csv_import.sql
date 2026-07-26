create or replace function public.import_canonical_stakeholders(
  p_workspace_id uuid,
  p_file_name text,
  p_rows jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_row jsonb;
  v_company_id uuid;
  v_company_name text;
  v_company_status text;
  v_stakeholder_id uuid;
  v_full_name text;
  v_imported integer := 0;
  v_companies_created integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required for CSV import'
      using errcode = '42501';
  end if;

  if p_workspace_id is null then
    raise exception 'A workspace is required for CSV import'
      using errcode = '22023';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'CSV import rows must be a JSON array'
      using errcode = '22023';
  end if;

  if jsonb_array_length(p_rows) = 0 then
    raise exception 'CSV import has no confirmed rows'
      using errcode = '22023';
  end if;

  if jsonb_array_length(p_rows) > 500 then
    raise exception 'CSV import is limited to 500 rows per batch'
      using errcode = '54000';
  end if;

  for v_row in
    select value
    from jsonb_array_elements(p_rows)
  loop
    v_company_name := btrim(v_row ->> 'company');
    v_full_name := btrim(v_row ->> 'full_name');

    if coalesce(v_company_name, '') = '' then
      raise exception 'Company is required for every CSV row'
        using errcode = '23514';
    end if;

    if coalesce(v_full_name, '') = '' then
      raise exception 'Full Name is required for every CSV row'
        using errcode = '23514';
    end if;

    v_company_id := null;
    v_company_status := null;

    select company.id, company.status
      into v_company_id, v_company_status
    from public.companies as company
    where company.workspace_id = p_workspace_id
      and company.normalized_name = lower(btrim(v_company_name))
    order by (company.status = 'active') desc, company.created_at
    limit 1;

    if v_company_id is not null and v_company_status <> 'active' then
      raise exception 'Company "%" is %; restore it or use its active replacement',
        v_company_name,
        v_company_status
        using errcode = '23514';
    end if;

    if v_company_id is null then
      insert into public.companies (
        workspace_id,
        name,
        created_by
      )
      values (
        p_workspace_id,
        v_company_name,
        auth.uid()
      )
      returning id into v_company_id;

      v_companies_created := v_companies_created + 1;

      insert into public.audit_events (
        workspace_id,
        entity_type,
        entity_id,
        action,
        diff_json,
        actor_user_id,
        actor_type
      )
      values (
        p_workspace_id,
        'company',
        v_company_id,
        'create',
        jsonb_build_object(
          'name', v_company_name,
          'source', 'csv_import',
          'file_name', p_file_name
        ),
        auth.uid(),
        'user'
      );
    end if;

    if exists (
      select 1
      from public.stakeholders as stakeholder
      where stakeholder.workspace_id = p_workspace_id
        and stakeholder.company_id = v_company_id
        and stakeholder.normalized_name = lower(
          regexp_replace(v_full_name, '\s+', ' ', 'g')
        )
    ) then
      raise exception 'Stakeholder "%" already exists in company "%"',
        v_full_name,
        v_company_name
        using errcode = '23505';
    end if;

    insert into public.stakeholders (
      workspace_id,
      company_id,
      full_name,
      title,
      department,
      seniority_level,
      influence_score,
      sentiment,
      sentiment_confidence,
      created_by
    )
    values (
      p_workspace_id,
      v_company_id,
      v_full_name,
      nullif(btrim(v_row ->> 'title'), ''),
      nullif(btrim(v_row ->> 'department'), ''),
      nullif(v_row ->> 'seniority_level', ''),
      (v_row ->> 'influence_score')::smallint,
      coalesce(nullif(v_row ->> 'sentiment', ''), 'UNKNOWN'),
      coalesce((v_row ->> 'sentiment_confidence')::smallint, 3),
      auth.uid()
    )
    returning id into v_stakeholder_id;

    v_imported := v_imported + 1;

    insert into public.audit_events (
      workspace_id,
      entity_type,
      entity_id,
      action,
      diff_json,
      actor_user_id,
      actor_type
    )
    values (
      p_workspace_id,
      'stakeholder',
      v_stakeholder_id,
      'create',
      jsonb_build_object(
        'name', v_full_name,
        'source', 'csv_import',
        'file_name', p_file_name,
        'csv_row', (v_row ->> 'row_number')::integer
      ),
      auth.uid(),
      'user'
    );
  end loop;

  return jsonb_build_object(
    'imported', v_imported,
    'companies_created', v_companies_created
  );
end;
$function$;

revoke all on function public.import_canonical_stakeholders(
  uuid,
  text,
  jsonb
) from public;
revoke all on function public.import_canonical_stakeholders(
  uuid,
  text,
  jsonb
) from anon;
grant execute on function public.import_canonical_stakeholders(
  uuid,
  text,
  jsonb
) to authenticated;

comment on function public.import_canonical_stakeholders(
  uuid,
  text,
  jsonb
) is
  'Atomically imports validated stakeholder CSV rows using caller RLS and records audit events.';

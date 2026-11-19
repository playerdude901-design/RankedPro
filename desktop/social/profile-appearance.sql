-- Ejecutar después de social/upgrade-1.1.0.sql en Supabase.
begin;
create or replace function public.publish_editor(appearance_data jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare
  avatar_data text := coalesce(appearance_data->>'avatar','');
  badges_data jsonb := coalesce(appearance_data->'badges','[]'::jsonb);
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if appearance_data is null or jsonb_typeof(appearance_data)<>'object' or octet_length(appearance_data::text)>90000 then
    raise exception 'Perfil demasiado grande';
  end if;
  if avatar_data<>'' and (avatar_data !~ '^data:image/png;base64,[A-Za-z0-9+/=]+$' or length(avatar_data)>70000) then
    raise exception 'Foto inválida';
  end if;
  if jsonb_typeof(badges_data)<>'array' or jsonb_array_length(badges_data)>500 then
    raise exception 'Insignias inválidas';
  end if;
  if exists(select 1 from jsonb_array_elements(badges_data) b where jsonb_typeof(b)<>'string' or length(b #>> '{}')>60) then
    raise exception 'Insignias inválidas';
  end if;
  update public.editors set appearance=jsonb_build_object(
    'avatar',avatar_data,
    'editor',case when appearance_data->>'editor' in ('premiere','capcut') then appearance_data->>'editor' else 'premiere' end,
    'country',case when appearance_data->>'country' ~ '^[A-Z]{2}$' then appearance_data->>'country' else '' end,
    'xp',case when jsonb_typeof(appearance_data->'xp')='number' then greatest(0,(appearance_data->>'xp')::numeric) else null end,
    'deco',left(coalesce(appearance_data->>'deco',''),80),
    'phrase',left(coalesce(appearance_data->>'phrase',''),80),
    'namefx',left(coalesce(appearance_data->>'namefx',''),60),
    'speed',least(4,greatest(0.25,coalesce(nullif(appearance_data->>'speed','')::numeric,1))),
    'badges',badges_data,
    'innerColor',case when appearance_data->>'innerColor' ~ '^#[0-9a-fA-F]{6}$' then appearance_data->>'innerColor' else '#a477ed' end,
    'outerColor',case when appearance_data->>'outerColor' ~ '^#[0-9a-fA-F]{6}$' then appearance_data->>'outerColor' else '#574571' end,
    'bio',left(coalesce(appearance_data->>'bio',''),500),
    'innerBorder',case when appearance_data->>'innerBorder' in ('none','violet','sakura','cyan','gold','prism','orbit','sweep','aurora','radiant') then appearance_data->>'innerBorder' else 'none' end,
    'outerBorder',case when appearance_data->>'outerBorder' in ('none','violet','sakura','cyan','gold','prism','orbit','sweep','aurora','radiant') then appearance_data->>'outerBorder' else 'none' end,
    'banner',left(coalesce(appearance_data->>'banner',''),80),
    'title',left(coalesce(appearance_data->>'title',''),80)
  ) where id=auth.uid();
end $$;
revoke all on function public.publish_editor(jsonb) from public,anon,authenticated;
grant execute on function public.publish_editor(jsonb) to authenticated;
commit;

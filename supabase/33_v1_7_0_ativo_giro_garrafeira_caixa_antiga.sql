-- Disb Gestao v1.7.0
-- SQL 33 - Novo item no cadastro de Ativo de Giro
--
-- Garrafeira 300ml c/24 (Caixa antiga)
-- Sem COD. SAP
-- Sem COD.

begin;

insert into public.rotating_asset_products(
  sap_code,
  asset_code,
  description,
  sort_order,
  active
)
values(
  null,
  null,
  'Garrafeira 300ml c/24 (Caixa antiga)',
  35,
  true
)
on conflict(description) do update set
  sap_code = null,
  asset_code = null,
  sort_order = excluded.sort_order,
  active = true;

commit;


-- Conferencia
select
  sap_code,
  asset_code,
  description,
  sort_order,
  active
from public.rotating_asset_products
where description =
  'Garrafeira 300ml c/24 (Caixa antiga)';
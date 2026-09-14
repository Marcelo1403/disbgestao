-- Dados mínimos apenas para teste. Apague ou substitua pelos seus dados reais.
insert into public.units(name) values ('Matriz Caicó'),('Filial Pau dos Ferros') on conflict do nothing;
insert into public.shifts(name) values ('Turno A'),('Turno B'),('Turno C') on conflict do nothing;
insert into public.drivers(name) values ('Henrique Duarte') on conflict do nothing;
insert into public.factories(name) values ('Itapissuma'),('Aquiraz'),('João Pessoa') on conflict do nothing;
insert into public.products(code,name) values ('9068','SKOL LATA 350ML SH C/12 NPAL') on conflict (code) do nothing;
insert into public.customers(code,name,city) values ('6730','Cliente Exemplo','Pau dos Ferros') on conflict (code) do nothing;

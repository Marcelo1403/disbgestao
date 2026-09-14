# Migração das planilhas antigas

1. Não exclua os aplicativos/planilhas antigos antes de validar a nova aplicação.
2. Exporte cada aba necessária como CSV.
3. No novo aplicativo, entre como Admin > Bases / importação.
4. Importe primeiro as bases de apoio: PRODUTOS, UNIDADES, TURNOS, MOTORISTAS, FABRICAS, CLIENTES.
5. Importe MAPAS.
6. Importe HISTÓRICO NRIS. O sistema preserva o número NRI e depois sincroniza a sequência automática.
7. Importe HISTÓRICO CONFERÊNCIAS.
8. Recrie usuários e senhas no módulo Usuários.

Depois dos testes, o Supabase passa a ser a fonte oficial. Google Sheets pode continuar sendo usado para análise/exportações, mas não fica no caminho das operações do aplicativo.

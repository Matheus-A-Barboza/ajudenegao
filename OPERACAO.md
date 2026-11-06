# Administração da rifa do Negão

## Acesso

Acessar `/admin` com a senha cadastrada como segredo `ADMIN_PASSWORD` no hosting. A senha não integra o código nem o pacote público. A sessão usa cookie HttpOnly, Secure e SameSite=None e Partitioned (compatível com a visualização incorporada), com validade de 8 horas. O botão Sair apaga o cookie do navegador. O cookie usa o prefixo __Host- e todas as mutações exigem Origin igual ao site para proteção contra CSRF. O cliente confirma a sessão em uma segunda consulta antes de exibir o painel. Há limite de 8 tentativas de entrada por IP em uma janela de 15 minutos. Para trocar a senha, atualizar ADMIN_PASSWORD e publicar uma versão; a troca invalida as sessões anteriores. A autenticação e a audiência do Sites continuam preservadas; o acesso privado do site é independente da senha do painel.

## Fluxo online

1. Participante escolhe até 10 números e informa nome e WhatsApp.
2. O banco reserva todos os números em uma transação, durante 30 minutos. Conflitos cancelam a operação inteira.
3. Participante copia o Pix de Ivanir Maria Prokoski e abre o link para o WhatsApp do organizador com mensagem pronta. É necessário anexar o comprovante e enviar a mensagem.
4. Após receber o comprovante, o organizador clica em Comprovante recebido no painel antes do vencimento. A reserva passa a aguardando conferência e não expira automaticamente.
5. Depois de conferir o recebimento com Ivanir, clicar em Confirmar Pix recebido. Os números passam a pagos.
6. Se houver problema, Cancelar e liberar devolve os números. A ação não cancela nem reembolsa pagamentos já confirmados.

Abrir o WhatsApp não confirma envio ou pagamento. Não há integração bancária nem envio automático de mensagens. Nomes e telefones só aparecem na API administrativa autenticada. A consulta pública expõe números e status e atualiza a cada 10 segundos; o painel atualiza a cada 15 segundos.

## Vendas manuais

Preencher nome, WhatsApp e até 50 números separados por vírgula. Marcar Já conferi o recebimento do Pix somente após conferência para registrar venda paga. Sem a marcação, é criada uma reserva por 30 minutos. O banco recusa números ocupados, inclusive se outro participante os reservar ao mesmo tempo.

Reservas expiradas ficam no histórico, mas não podem ser confirmadas. Se um Pix chegar depois do vencimento, conferir disponibilidade e registrar venda manual apenas dos números livres, combinando uma solução com o participante quando houver conflito. Números pagos não podem ser liberados pela ação de cancelar reserva.

## Configuração e dados

campaign.json configura valor, números, Pix, WhatsApp, prêmios e regra do sorteio. A campanha tem 500 números, de 001 a 500, por R$5,00 cada. Nenhum sorteio automático é executado pelo site. A data ou antecipação do sorteio é uma regra informativa para o organizador.

O D1 contém tickets (ocupação atual dos números), reservations (histórico e contato) e login_attempts (controle temporário de tentativas). Não alterar preço ou quantidade após iniciar vendas. A configuração enabled depende também da presença da senha administrativa. Não há armazenamento de arquivos de comprovantes; eles são enviados pelo WhatsApp.

## Verificação

`npx tsc --noEmit` verifica os tipos. `node tests/integration.mjs` usa o Miniflare e o esbuild que acompanham o Wrangler instalado para exercitar as APIs reais em um D1 temporário, com dados e senha fictícios. Não toca no banco de produção e não envia mensagens ao WhatsApp. O teste cobre autenticação, CSRF, sessão adulterada, limitação de tentativas, privacidade, reservas simultâneas, rollback, expiração, conferência, confirmação, cancelamento e vendas manuais.

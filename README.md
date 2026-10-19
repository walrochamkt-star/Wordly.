# Wordly: conversa online

Esta proposta substitui o modelo WebLLM executado no computador do aluno por uma API de IA no servidor. O microfone e a síntese de voz continuam no navegador. Não inclui voz neural externa.

## Estado da entrega

Código e testes com API simulada concluídos. A qualidade das respostas, latência, saldo e acesso ao modelo precisam ser validados com uma chave real antes de considerar a migração concluída. O site estático atual não muda enquanto esta proposta não for ativada.

## Ativar no Render

1. Criar um **Web Service** Node com este repositório e a branch `fix/conversation-online`. O serviço estático existente não executa Node. Uma nova URL será gerada para validar a migração.
2. Build: `npm install --omit=dev`. Start: `npm start`. Health check: `/healthz`.
3. Configurar em **Environment**, diretamente no Render:
   * `OPENAI_API_KEY`: chave privada de um projeto com acesso à API e faturamento configurado.
   * `OPENAI_MODEL`: ID de um modelo habilitado na conta, compatível com Chat Completions e mensagens `developer`. Escolher um modelo apropriado para conversação e testar sua precisão em todos os idiomas.
   * `WORDLY_USER`: usuário de acesso para o piloto privado.
   * `WORDLY_PASSWORD`: senha exclusiva e forte para o piloto. O navegador solicitará o acesso ao abrir a página.
   * `WORDLY_DAILY_LIMIT`: limite global de chamadas por dia, padrão 200. Não é um teto monetário. Configure também um orçamento no provedor.
4. Publicar e testar na nova URL. A API recebe o texto reconhecido ou digitado e até 13 mensagens recentes. Não recebe o áudio do microfone. O histórico permanece na memória da página. Chamadas usam `store: false`.
5. Validar os casos abaixo antes de substituir a URL de uso. Não declarar a qualidade resolvida apenas porque os testes de transporte passam.

`render-cloud.yaml` é uma alternativa de Blueprint para este serviço; o `render.yaml` original foi preservado para o site estático existente.

Nunca colocar a chave ou senha nos HTMLs, no GitHub ou em uma mensagem do chat. A autenticação e os limites são para piloto privado; um lançamento público precisa de contas individuais e limitação de uso persistente. O contador em memória reinicia a cada deploy/reinício. O plano gratuito do Render pode ter partida lenta após inatividade.

## Validação com o modelo real

Para cada um dos cinco professores:

1. Perguntar a tradução de “bom dia” e avaliar precisão.
2. Perguntar por que uma expressão é usada e verificar se a explicação responde à pergunta.
3. Dizer o nome; depois perguntar “qual é o meu nome?”.
4. Pedir “explique em português e sem brincadeira”.
5. Pedir uma correção gramatical e conferir com referência confiável.
6. Manter pelo menos seis trocas no mesmo assunto, com perguntas de continuidade.
7. Testar A1, A2 e B1. No A1, português nas explicações e idioma novo entre `[[...]]`.
8. Medir tempo de resposta e testar falhas de rede, saldo e acesso ao modelo.
9. Testar voz, duas gravações sucessivas, envio por Enter durante gravação e interrupção da fala do professor.

## Desenvolvimento

Node 22 ou superior. `npm test` executa validação do servidor, isolamento do microfone e histórico. As chamadas externas são simuladas nos testes; nenhuma credencial real é necessária.

Documentação da API usada: https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create

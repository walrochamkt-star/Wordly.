# Wordly: modo local sem cota diária e Gemini opcional

Em cada professor, selecione **No meu aparelho — sem cota diária** e inicie. O modo local usa WebLLM 0.2.85 e Qwen3 4B, em um Web Worker; não chama o Gemini, não precisa de chave e não usa cotas de uma API. As instruções locais compactas mantêm os cinco idiomas e os ajustes de nível, humor e situação.

O primeiro carregamento baixa alguns GB de Hugging Face, além do runtime via jsDelivr. Requer WebGPU, GPU e memória disponíveis. Há progresso e cancelamento. O cache é administrado pelo navegador e pode ser apagado. Não há promessa de desempenho ou qualidade equivalentes ao Gemini. A página precisa ser aberta/carregada pela internet; não é uma instalação offline completa. Reconhecimento de voz pode depender dos serviços do navegador.

O modo Gemini online permanece opcional, sujeito às cotas gratuitas do Google. Não há troca automática de modo nem envio silencioso da conversa a uma API se o modo local falhar. No modo local, erros pedem nova tentativa ou a escolha manual do online.

Documentação: https://webllm.mlc.ai/docs/user/get_started.html e https://webllm.mlc.ai/docs/user/advanced_usage.html

## Ativar no Render

1. Criar um **Web Service** Node com este repositório e a branch `fix/conversation-online`. O serviço estático existente não executa Node. Uma nova URL será gerada para validar a migração.
2. Build: `npm install --omit=dev`. Start: `npm start`. Health check: `/healthz`.
3. Configurar em **Environment**, diretamente no Render:
   * `GEMINI_API_KEY`: chave privada criada no Google AI Studio em um projeto **Free Tier, sem conta de faturamento vinculada**. Não cadastrar cartão nem ativar faturamento.
   * `GEMINI_FREE_TIER_CONFIRMED`: mudar para `true` somente após verificar manualmente que o projeto da chave está no Free Tier, sem faturamento. O servidor não consegue consultar nem bloquear o faturamento da conta Google. Se o projeto for posteriormente migrado para um plano pago, interromper o serviço ou remover a chave.
4. Publicar e testar na nova URL. A API recebe o texto reconhecido ou digitado e até 13 mensagens recentes. Não recebe o áudio do microfone. O histórico permanece na memória da página. No Free Tier, o Google pode usar as conversas para melhorar seus produtos, conforme os termos do serviço. Não inserir dados pessoais sensíveis. A cobrança depende do projeto Google, não da chave isoladamente.
5. Validar os casos abaixo antes de substituir a URL de uso. Não declarar a qualidade resolvida apenas porque os testes de transporte passam.

`render-cloud.yaml` é uma alternativa de Blueprint para este serviço; o `render.yaml` original foi preservado para o site estático existente.

Nunca colocar a chave ou senha nos HTMLs, no GitHub ou em uma mensagem do chat. O site é público, sem usuário ou senha, e não impõe teto diário próprio. Mantém proteção de frequência e simultaneidade. As cotas gratuitas do Google e os limites do Render continuam valendo. O plano gratuito do Render pode ter partida lenta após inatividade.

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

Documentação oficial consultada em 19/10/2026:

* https://ai.google.dev/gemini-api/docs/openai
* https://ai.google.dev/gemini-api/docs/pricing
* https://ai.google.dev/gemini-api/docs/billing

Quando o Google retornar limite de cota (429), o app informa que é necessário aguardar. Não tenta outro provedor ou modelo e não faz recarga nem muda a conta de plano. O modelo é fixo para impedir uma seleção acidental de modelo pago. A disponibilidade e os limites reais do Free Tier precisam ser confirmados na conta antes da ativação.

Criar chave gratuita: https://aistudio.google.com/apikey . Fazer a criação e eventual aceite de termos diretamente no Google, sem compartilhar a chave no chat.

## Conversa local, pronúncia e compatibilidade

O modo local principal usa Qwen3 4B. Qwen3 1.7B foi comparado no navegador e rejeitado: respondeu em português ao ser solicitado a traduzir bom dia para espanhol. Por isso o modelo principal não foi substituído e não há opção leve na interface. Antes do download, a interface consulta a disponibilidade de WebGPU e dá avisos para aparelhos com pouca memória reportada pelo navegador. Isso não é certificação de compatibilidade de todos os celulares.

Respostas locais usam JSON com idioma principal explícito, convertido para a apresentação do Wordly. Frases no idioma alvo recebem marcação mesmo que o modelo omita os colchetes; português e idioma alvo continuam com vozes separadas. A declaração do idioma depende do modelo. Nomes explicitamente informados pelo aluno são preservados como contexto durante a sessão, além das últimas mensagens; não são salvos em disco. A memória do restante da conversa continua limitada pelo contexto do modelo.

## Voz do Torito

Torito usa por padrão Piper com a voz espanhola fixa `es_ES-davefx-medium`, executada no navegador em Web Worker. O primeiro uso baixa modelo e arquivos WASM; os dados de voz ficam sujeitos ao cache/armazenamento do navegador. A voz é sintetizada, não uma gravação humana nem uma promessa de naturalidade indistinguível. Testar voz funciona antes de carregar o modelo de conversa.

O modo alternativo só aceita vozes espanholas com identidade masculina conhecida pelo nome. Se nenhuma estiver disponível, avisa em vez de escolher uma voz feminina ou portuguesa. Não se modifica o pitch para simular gênero. O áudio do Torito é espanhol, inclusive no A1; a tradução portuguesa permanece no texto. Explicações locais em português fora dos trechos marcados não são narradas.

Runtime: https://github.com/Mintplex-Labs/piper-tts-web (MIT), fixado em 1.0.3. Voz: https://huggingface.co/rhasspy/piper-voices/tree/main/es/es_ES/davefx/medium (consultar MODEL_CARD; conjunto de dados CC0). Downloads do runtime: jsDelivr/cdnjs. Modelo servido pelo espelho diffusionstudio/piper-voices usado pela biblioteca. A síntese não usa API paga nem envia o texto a um serviço de TTS.

# Wordly

Aprenda idiomas conversando por voz com professores de IA. Gratuito.

| Professor | Idioma |
|---|---|
| Torito | Espanhol |
| Coquette | Francês |
| Lupino | Italiano |
| Bärli | Alemão |
| Leeuwie | Neerlandês |

## Como funciona

Site estático (HTML puro, sem servidor). A IA roda no aparelho do aluno pelo navegador:

- Cérebro: modelo de linguagem aberto via WebLLM (WebGPU), baixado uma vez e guardado no navegador.
- Ouvir: reconhecimento de voz do navegador.
- Falar: voz do navegador.

Use no Google Chrome ou no Microsoft Edge atualizados.

## Publicar no Render

1. No Render, clique em **New** e depois em **Blueprint**.
2. Escolha este repositório. O arquivo `render.yaml` já configura tudo como site estático gratuito.

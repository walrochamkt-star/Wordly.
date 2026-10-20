# Wordly: ilustrações das cenas

Referências fornecidas pelo usuário: Torito em campo tranquilo; Mascote francesa em campo de lavanda; Urso mascote com bandeira alemã; Lupino no vinhedo italiano; Leãozinho dourado entre tulipas e moinho.

Geração com a ferramenta integrada image_gen, uma referência por personagem. Direção: textura de papel mate, formas planas arredondadas como recorte, pintura gouache suave, olhos ovais pretos simples, sorriso pequeno curvo, sem contornos pretos ou acabamento 3D. Preservar espécie, proporções, cores e acessórios de cada mascote. Todos os interlocutores devem ser animais da mesma espécie do professor. Cenários de situações cotidianas, sem textos, balões ou logotipos.

As ilustrações do atlas foram rejeitadas por baixa resolução e enquadramento. A versão corrigida usa 50 imagens individuais: dez ambientes por professor (café, rua, transporte, hotel, casa, compras, saúde, trabalho/estudos, vida social e atendimento público). Situações do mesmo ambiente reutilizam a mesma ilustração completa. Nenhuma imagem é extraída de uma grade.

Cada fonte é gerada individualmente, com mais de 1.200 pixels de largura, com os animais inteiros e margem de segurança. A versão WebP de qualidade 93 é incorporada num módulo em `individual-art/<teacher>-<environment>.mjs`. O componente usa uma imagem HTML real com `object-fit: contain`, sem recorte nem distorção, carregada quando aparece na tela. O mapeamento está em `scene-illustrations.mjs`.

Os próprios mascotes de referência aparecem temporariamente enquanto a ilustração individual carrega ou quando o ambiente ainda não está disponível. Os contatos do celular continuam usando as referências originais otimizadas, sem redesenhar os mascotes.

# Flávio Autoplayer — protótipo local

## Objetivo
Construir um bot para cadeflavio.run que leia o estado real do jogo e tente atravessar a ponte até entrar na cabine. A entrada na cabine é a conclusão da primeira etapa; o diálogo subsequente tem um final narrativo em que o avião não decola.

## Escopo autorizado
O usuário pediu execução autônoma do projeto após discutir uma ponte de leitura do motor, decisões pequenas e controle local contínuo. A implementação será feita nesta sessão. Não haverá publicação nem serviço pago.

## Decisões de implementação
- JavaScript, sem dependências de execução no navegador.
- Leitura de `window.__game`, recurso já fornecido pelo jogo ao abrir `?debug`.
- Nunca alterar posição, vidas, inimigos, velocidade ou cancela; nunca chamar startCabin para simular vitória.
- Executar movimento apenas com eventos normais de teclado. Iniciar/reiniciar por botões existentes.
- Controlador preditivo local; integração com Jev é extensão futura e não é necessária para este protótipo.
- Distribuição como extensão para Brave/Chrome, acionada pelo usuário somente em cadeflavio.run.
- Painel com iniciar/parar, estado, vidas, progresso, última decisão e exportação de registros.
- F8, Escape, perda de foco e aba oculta param o bot e soltam as teclas.
- Desempenho e sucesso serão medidos, sem promessa prévia de vitória.

## Validação
Testes de previsão de colisão/cancela, interrupção e recusa de estados inválidos. Testes em um navegador isolado com o jogo real, registrando resultado, vidas e duração. O teste de integração não altera o motor ou as regras do jogo. Os arquivos originais baixados ficam em work/, fora da distribuição.

## Evidência do alvo
HTML público obtido em 2026-10-28. Script inline extraído sem alteração para análise estática. O próprio script expõe player, gate, enemies, cars, ghosts e state em `?debug`. Velocidade do jogador 245 unidades/s; entrada na cabine em x >= 6165; pista y=185..400 com raio 12. Nenhum acesso a dados de outras abas.

## Emenda autorizada — controle de velocidade, versão 0.3

Pedido posterior do usuário: manipular e aumentar a velocidade do personagem. Isso substitui exclusivamente a restrição original de não escrever em `player.speed`: um controle explícito 1×/2×/3× pode alterar esse campo e restaurá-lo ao valor capturado na ativação. O padrão continua 1×; nenhuma alteração é aplicada ao instalar o painel. Vidas, posição, inimigos, cancela e atalhos de vitória permanecem fora das escritas autorizadas. Ajustes ficam identificados no painel e nos registros como velocidade modificada.

### Ampliação solicitada — versão 0.4

O usuário pediu explicitamente 20×. O limite do ajuste passa a 20 e o painel inclui esse botão adicional, preservando padrão 1×, restauração e identificação de velocidade modificada. Nenhuma outra escrita no motor foi autorizada.

# Registro da implementação — 28/10/2026

- Objetivo autorizado: executar autonomamente um projeto de controle baseado no estado interno do jogo.
- Projeto novo, criado em diretório próprio; não havia repositório ou trabalho anterior para isolar. Repositório local na branch `bot-prototype`; nenhuma publicação ou integração remota.
- Plano: `superpowers/plans/2026-10-28-autoplayer.md`.
- Desvio deliberado: decisor preditivo local no lugar de API Jev; o usuário aprovou a ponte e o controle como primeiro projeto, e nenhuma credencial/API paga foi necessária.
- HTML observado: SHA-256 `020549a0e1e4112875895afec8101a66a67fac5fab44b93cf0a2d46a6e58edc8`.
- Script inline extraído para análise estática: SHA-256 `622f078d8c18b78e1d97c6b72ae89c7f5f8f5c6a2a5a32331ec1c87e3153cd16`.
- REA analisou a árvore de JavaScript extraída; a leitura direta do código identificou o recurso `?debug` e as regras da simulação. A tentativa inicial de descoberta do navegador não tinha endpoint CDP disponível; não foi alterado o navegador do usuário para obtê-lo.
- Testes unitários escritos antes dos respectivos módulos. Primeiras execuções falharam por ausência desses módulos; as implementações passaram em seguida. A suíte final tem 15 testes.
- Primeira partida real: cabine, 5 vidas, 28.342 ms, 552 decisões.
- Segunda partida real (testes adicionais de parada/exportação): cabine, 5 vidas, 27.579 ms, 545 decisões.
- Revisão independente encontrou um P2: uma tecla manual podia dessincronizar o conjunto de teclas do bot. Reproduzido no navegador com falha `Entrada manual não interrompeu o bot`; corrigido interrompendo em eventos confiáveis de setas/WASD. O teste correspondente passou na versão final.
- Primeira partida após a correção: cabine, 4 vidas, 27.384 ms, 544 decisões, média de 2,28 ms por decisão.
- Última execução, aguardando a atualização do painel antes da captura de tela: cabine, 2 vidas, 26.890 ms, 534 decisões, média de 2,42 ms por decisão. Este é o resultado detalhado em `reports/validation.json` e na imagem distribuída. As diferenças entre partidas mostram a influência do tempo entre quadros; não se afirma vitória sem perda de vidas.
- Validação final de navegador: F8, Escape, controle manual, tratamento de blur e exportação JSON passaram. O teste de blur despacha o evento; não é uma prova de todas as condições de foco do sistema operacional.
- Observação menor da revisão: o botão de iniciar não reinicia após a cabine. A documentação explica a recarga da página para outra tentativa; não foi adicionada automação do diálogo.
- Limite da validação: mesmo pacote injetado no Brave isolado, mas extensão não instalada no perfil pessoal do usuário. Manifesto e carregador inspecionados e testados separadamente.
- Os recursos originais do jogo permanecem fora da distribuição. O pacote só inclui código do bot, documentação e registros de validação.

## Estado das tarefas

- Task 1: complete — previsão, colisões e cancela; testes verdes.
- Task 2: complete — ponte, teclas, painel, interrupção e extensão pronta.
- Task 3: complete — partida real concluída, correção revisada, verificação final e pacote de entrega.

## Atualização visual — versão 0.2

- Pedido: caixas sobre obstáculos e uma apresentação mais visual para gravar e compartilhar.
- Implementado: cores por tipo, distância em unidades do jogo, proximidade destacada, rastro observado, seta do comando atual, caixa da cancela e camada alinhada ao canvas do jogo.
- V alterna as caixas; G recolhe os controles sem parar o bot. F8/Escape e entrada manual continuam interrompendo como antes.
- Projeção da câmera, limites do mapa, descarte de objetos fora da tela e ausência de caixas na cabine têm testes. Suíte atual: 21 testes aprovados.
- Revisão independente aprovou sem bloqueadores. Um detalhe do rastro foi corrigido: ocultar/reexibir limpa o histórico, evitando unir posições não observadas com um atalho visual falso. A caixa da cancela indica o estado de bloqueio e aproxima a animação do braço.
- Duas partidas com a camada visual e gravação chegaram à cabine com 5 vidas. O teste verificou V, G, ausência de erros da página e alinhamento do canvas de 1280×720.
- `reports/visual-validation.json` registra a última execução. `visual-preview.png` mostra as caixas durante a partida e `visual-result.png` comprova a entrada na cabine. O MP4 de demonstração é entregue separadamente, sem áudio.
- Nenhuma alteração no decisor ou nas regras do jogo. A camada é somente visual e não recebe cliques.

## Controle experimental de velocidade — versão 0.3

- Autorização posterior explícita: usuário pediu manipular e aumentar a velocidade do personagem. A restrição anterior de não escrever em velocidade foi substituída somente para esse campo e somente por controles explícitos.
- `createSpeedControl` captura a velocidade original sem modificá-la. Botões 1×/2×/3× escrevem apenas no `player.speed` atual; não acumulam multiplicações. Padrão 1×, sem persistência entre recargas.
- Vidas, posição, inimigos, cancela e atalhos de vitória não são modificados. O painel e os registros identificam velocidade modificada, inclusive no modo de gravação.
- Quatro testes novos verificam padrão, multiplicação sobre a base, restauração, rejeição de valores inválidos e uso do jogador atual. Suíte: 25 testes aprovados.
- Medição de movimento manual: 147 unidades em 0,6 s do motor a 1× e 294 unidades em 0,6 s a 2×. Velocidades no motor: 245 e 490 unidades/s; razão observada em tempo real: 2,009×.
- Medição inicial somente por tempo de parede variou e falhou. Foram acrescentados os tempos do motor à instrumentação; o critério do teste agora usa esses tempos porque o jogo limita o incremento por quadro. O tempo real continua registrado separadamente.
- Partidas reais com a nova opção: 2× chegou à cabine com 5 vidas em 14.749 ms; 3× com 5 vidas em 8.800 ms. Botão original e recarga restauraram 245 unidades/s. Relatório em `reports/speed-validation.json`.
- Essas partidas aceleradas têm uma regra modificada; os relatórios anteriores de velocidade original continuam preservados.
- Revisão independente do controle de velocidade: sem achados acionáveis; padrão sem escrita, restauração, não acumulação e identificação no painel confirmados. O revisor executou a suíte de 25 testes com sucesso.

## Velocidade 20× — versão 0.4

- Pedido explícito do usuário: incluir velocidade 20×. Limite ampliado para 20, com um botão adicional no painel; padrão/restauração permanecem 1×.
- Teste novo confirma 2×→20× sem acumulação (245→4.900) e retorno direto a 245. Suíte de 26 testes passou; bundle gerado e sintaxe verificados.
- Partida real a 20×: entrada na cabine, 4 vidas, 100%, 1.496 ms. O registro de decisões contém velocidade 4.900. Restauração pelo botão e recarga para 245 confirmadas.
- Relatório separado `reports/speed20-validation.json` preserva os resultados anteriores de 1×/2×/3×. Nenhuma alteração foi feita no decisor ou na física de colisões do jogo; o único campo de jogo escrito continua sendo player.speed.

## Arma e disparos — versão 0.5

- Pedido explícito: engenharia reversa, dar uma arma ao personagem e fazê-lo atirar. Emenda ao escopo permite remover somente o primeiro alvo atingido por cada projétil do mod, além do ajuste de velocidade já autorizado.
- Nova observação do HTML público em 28/10/2026: SHA-256 `5b27ebda7b9fd957adb38b58c4315f74375f7fe79ae23415f3d696520ee9857c`. O site mudou desde a análise inicial: há dificuldade selecionável e um novo perseguidor Constituição. Não foi encontrado sistema nativo de arma/disparos; a motosserra original é parte do desenho da roupa.
- REA analisou a árvore extraída de JavaScript (SHA da árvore `2aa86cb2009f2efecff215a2019a9d32e5dfb6223db6a8d6cf69c1be7b377cc8`). Evidência de análise `ev_c08b6de10596e752b9bb93bd8f64cab40f14f7a1ce0d67899fc2c6b924716e61`, resumo `ev_625caf3741bbf84132c6e0e1f9ab7ed0131ac2d2f928bcb6c4c345df00e5170e`. A análise estática é parcial; os resultados abaixo vêm de execução real separada.
- O debug oferece getters para os arrays vivos `enemies`, `cars`, `ghosts` e `consts`. A remoção por splice no impacto tira o alvo tanto do desenho original quanto da colisão original. O mod não muda vidas, posição, cancela ou condição de vitória.
- `weapon.js`: mira com antecipação, cadência limitada, trajetória segmentada para evitar atravessar alvos em alta velocidade, primeiro impacto por projétil, contadores e eventos. `weapon-view.js`: arma, recuo, clarão, projéteis, mira e impactos em camada independente das caixas.
- J manual, disparo automático somente durante a execução do bot, botões para arma/automático, contadores no modo de gravação e exportação JSON. Parar cancela gatilho e projéteis; recarga/reinício limpa os contadores e o motor restaura os alvos.
- Oito testes novos de arma foram escritos antes da implementação, falharam sem o módulo e passaram depois. Dois testes adicionais cobrem cópia do novo perseguidor e colisão aos 0,61 segundos. Suíte final: 36 testes aprovados; bundle e sintaxe verificados.
- Revisão independente identificou um P2: Constituição aparece em 1 segundo, enquanto fantasmas levam 1,2. O decisor herdava o tempo dos fantasmas. Teste de colisão aos 0,61 s reproduziu a falha; previsão corrigida por tipo e teste passou.
- Validação adicional da parada reproduziu um erro: a repetição de J ainda segurado podia rearmar o gatilho depois de F8. O teste falhou com dois tiros extras; o controle agora ignora keydown repetido e exige soltar/pressionar J novamente após parar.
- `scripts/verify-weapon.mjs` usa o bundle distribuído em um Brave temporário. Inicia e move somente pelos controles normais; nenhuma escrita de posição, vidas ou atalho para cabine nos testes. Verifica tiro manual com o bot parado, queda real na quantidade de alvos, F8/Escape inclusive repetição de J, desativação, recarga e partidas automáticas a 1×/20×. A dificuldade testada é normal.
- Última execução após as correções: 1× entrou na cabine com 5 vidas, 71 disparos e 39 acertos (18 PRF, 11 manifestantes, 8 viaturas, 1 Constituição e 1 fantasma). A 20× entrou com 4 vidas, 7 disparos e 7 acertos. Tiro manual removeu 1 PRF com o bot parado; F8/Escape, repetição de J, desativação e recarga passaram; nenhum erro de página. Detalhes em `reports/weapon-validation.json`.
- O MP4 de demonstração é uma gravação da partida real com o mod, sem áudio. A extensão não foi recarregada automaticamente no perfil pessoal do usuário; ele deve recarregar seu cartão e a página para usar esta atualização.

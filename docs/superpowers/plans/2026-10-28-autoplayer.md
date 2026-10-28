# Flávio Autoplayer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar e testar um controlador local que atravesse a primeira etapa de cadeflavio.run por comandos de teclado.

**Architecture:** Uma ponte normaliza leituras do recurso de debug existente. Um decisor prevê movimentos e colisões; um executor aplica diferenças nas teclas pressionadas e registra resultados. A extensão injeta o pacote na página, e o teste usa um navegador isolado.

**Tech Stack:** JavaScript, Node.js test runner, Playwright somente para desenvolvimento.

**Spec:** ../specs/2026-10-28-autoplayer-design.md

## Global Constraints
- Sem dependências de execução no navegador.
- Leitura de `window.__game`; nenhuma escrita nos objetos do motor.
- Entrada na cabine comprova a conclusão da primeira etapa.
- Escape/F8 e perda de foco interrompem e soltam as teclas.
- Extensão limitada a cadeflavio.run; sem serviços pagos.

## Review Focus
- Interrupção enquanto há teclas pressionadas deve soltá-las.
- Estado ausente ou inválido deve impedir movimento.
- Cancela fechada não pode ser atravessada na previsão.
- Fantasmas e viaturas precisam de geometrias distintas.
- Mudança do jogo deve falhar de forma explícita.

### Task 1: Decisor preditivo
**Files:** src/planner.js, test/planner.test.js
**Interfaces:** `decide(snapshot) -> {dx,dy,reason,score}`; snapshot contém cópias de player/gate/enemies/cars/ghosts/state.
- [ ] Escrever testes que falhem: avançar em pista vazia, evitar obstáculo frontal, aguardar/desviar diante da cancela, respeitar limites e rejeitar estado inválido.
- [ ] Rodar `node --test test/planner.test.js`; confirmar falha antes de implementar.
- [ ] Implementar previsão local com horizonte curto e ações discretas.
- [ ] Rodar os testes e confirmar sucesso; commit.

### Task 2: Ponte, controles e distribuição
**Files:** src/controller.js, scripts/build.mjs, extension/manifest.json, extension/background.js, test/controller.test.js
**Interfaces:** `installBot(window,document)` instala painel e executor; usa `decide` da Task 1.
- [ ] Escrever teste de interrupção: soltar teclas em parada e estado terminal; ler cópias sem alterar o jogo.
- [ ] Confirmar falha, implementar painel e executor, confirmar sucesso.
- [ ] Empacotar extensão e documentar ativação explícita no Brave; commit.

### Task 3: Integração real e entrega
**Files:** scripts/verify.mjs, README.md, reports/validation.json
**Interfaces:** carrega o pacote no jogo real e observa `state`, vidas e posição; não escreve estado do motor.
- [ ] Rodar partidas em navegador isolado com limites de tempo/tentativas; inspecionar registros.
- [ ] Corrigir problemas reproduzidos, com testes pertinentes.
- [ ] Verificar interrupção e exportação no navegador; registrar evidência e screenshot.
- [ ] Rodar a suíte completa, revisão independente e empacotamento final.

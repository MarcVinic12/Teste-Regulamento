# Quiz do Regulamento – Seletiva Nacional WorldSkills 2025

Site de estudo **não oficial** com 96 perguntas sobre o *Regulamento WorldSkills Brasil – Seletiva Nacional 2025* (versão 1.0, 27/10/2024).

**Acesse:** https://marcvinic12.github.io/Teste-Regulamento/

## Funcionalidades
- **Modo Estudo:** correção imediata com explicação e referência da seção.
- **Modo Simulado:** N perguntas aleatórias, cronômetro opcional, correção no final, nota e desempenho por seção.
- Filtros por seção, tipo e dificuldade. Embaralha perguntas e alternativas.
- Revisão dos erros e botão "Refazer só as que errei".
- Progresso e histórico salvos no `localStorage` do navegador.
- 7 tipos de pergunta: V/F, múltipla escolha, várias corretas, lacuna, ordenar (arrastar ou ↑/↓), associar e cenário.
- Responsivo, com tema claro/escuro e navegação por teclado.

## Estrutura
```
index.html          página única
css/style.css       estilos (mobile first, tema claro/escuro)
js/app.js           lógica do quiz (JavaScript puro)
data/questions.json banco de perguntas
```

## Rodar localmente
```bash
python -m http.server 8000
```
Depois abra http://localhost:8000. O site precisa de um servidor, porque lê o JSON via `fetch`.

## Formato das perguntas
Cada item de `data/questions.json` tem `id`, `tipo`, `secao`, `dificuldade`, `enunciado`, `opcoes`, `resposta`, `explicacao`, `referencia` e `regra_id`. Em `ordenar`, `opcoes` vem na ordem correta. Em `associar`, `opcoes` é uma lista de pares `[termo, definição]`.

---
**Material de estudo não oficial. Consulte sempre o regulamento original.** O PDF do regulamento não está neste repositório.

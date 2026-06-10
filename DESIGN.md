---
version: alpha
name: Amchat Flowbuilder
description: Sistema de design minimalista, limpo e profissional para o construtor de fluxos Amchat, focado em alta legibilidade, contraste harmônico e formas geométricas suaves.

colors:
  # Base e Superfícies
  background: "#FFFFFF"
  surface: "#FFFFFF"
  surface-dim: "#F8F9FA"
  surface-container: "#F1F3F5"
  surface-container-high: "#E7E7E9" # Cinza de contraste médio
  
  # Cores de Destaque / Marca
  primary: "#2781F6" # Azul principal vibrante
  on-primary: "#FFFFFF"
  primary-container: "#E3EFFF"
  on-primary-container: "#0054B4"
  
  # Textos
  text-primary: "#1A1C1E"
  text-secondary: "#535659" # Cinza escuro para legibilidade secundária
  
  # Contornos e Bordas
  outline: "#E7E7E9" # Cinza claro para bordas estruturais
  outline-variant: "#C1C4C7"
  
  # Ícones e Elementos Outline
  icon-outline: "#535659" # Cor padrão para ícones de linha simples

typography:
  display-lg:
    fontFamily: Inter, sans-serif
    fontSize: 48px
    fontWeight: "700"
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter, sans-serif
    fontSize: 24px
    fontWeight: "600"
    lineHeight: 32px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter, sans-serif
    fontSize: 18px
    fontWeight: "400"
    lineHeight: 28px
  body-md:
    fontFamily: Inter, sans-serif
    fontSize: 14px
    fontWeight: "400"
    lineHeight: 22px
  label-sm:
    fontFamily: Inter, sans-serif
    fontSize: 12px
    fontWeight: "600"
    lineHeight: 16px
    letterSpacing: 0.05em

rounded:
  sm: 4px
  DEFAULT: 8px
  md: 12px
  lg: 16px
  full: 9999px

spacing:
  unit: 8px
  container-padding: 24px
  card-gap: 16px
  node-gap: 24px

components:
  card-node:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.outline}"
    borderWidth: 1px
    rounded: "{rounded.md}"
    padding: "{spacing.card-gap}"
  
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.DEFAULT}"
    height: 40px
    padding: 0 16px
    
  icon-simple-outline:
    color: "{colors.icon-outline}"
    strokeWidth: "1.5px"
    size: 24px
---

# Design System - Amchat Flowbuilder

Este documento define o contrato visual e os tokens de design do **Amchat Flowbuilder** para garantir consistência estética e de implementação pela inteligência artificial e desenvolvedores.

## Overview

O Amchat Flowbuilder é um editor visual de fluxos de conversação. Para facilitar o foco do usuário no fluxo de lógica, a interface adota um estilo **minimalista e limpo**. As superfícies brancas reduzem a carga cognitiva, os cantos arredondados trazem suavidade ao ambiente de desenvolvimento e os ícones outline garantem uma leitura simples e sem distrações visuais.

## Colors

As cores devem ser aplicadas seguindo uma hierarquia estrita de importância:

*   **Azul Principal (`#2781F6`)**: Utilizado para botões de ação principal, status ativo, caminhos de fluxos selecionados e conexões.
*   **Branco (`#FFFFFF`)**: Cor de fundo predominante do canvas e dos cartões dos nós (nodes) do fluxo, promovendo um layout arejado e limpo.
*   **Cinza Contraste (`#E7E7E9`)**: Utilizado para delimitar contornos (`outline`), bordas de componentes e fundo de caixas secundárias (como inputs ou menus inativos).
*   **Cinza Escuro (`#535659`)**: Aplicado a ícones de estilo outline e textos secundários, oferecendo ótimo contraste sem o peso do preto puro.

## Typography

Utilizamos a família de fontes **Inter** em toda a aplicação. Ela foi escolhida pelo seu excelente desempenho em renderização de telas, especialmente em textos pequenos e labels de nós de fluxos.

*   A escala tipográfica varia desde títulos grandes (`display-lg`) para páginas de boas-vindas até textos compactos de controle (`label-sm`).
*   O espaçamento entre letras (letter-spacing) deve ser ligeiramente reduzido em títulos grandes para manter a coesão visual.

## Layout

O layout do construtor de fluxos segue um grid invisível baseado na unidade de `8px` (`{spacing.unit}`).
*   **Espaçamento entre Nós (`{spacing.node-gap}`)**: Mantém uma distância padrão de `24px` para evitar sobreposição ou confusão nas linhas de conexão do fluxo.
*   **Padding dos Recipientes (`{spacing.container-padding}`)**: Menus laterais, paleta de componentes e modais de configuração utilizam `24px` de espaçamento interno para manter o layout legível.

## Elevation & Depth

Como se trata de uma interface bidimensional minimalista, a elevação é usada de maneira pontual:
*   A maioria dos elementos do fluxo (nós, conexões) deve ser **plana (flat)** com contornos sutis em `#E7E7E9`.
*   Sombras projetadas muito suaves e difusas são restritas a painéis flutuantes (como a paleta de componentes de arrastar e modais de configuração rápidos) para sugerir que flutuam sobre o canvas do fluxo.

## Shapes

As formas geométricas do Amchat Flowbuilder são caracterizadas por cantos arredondados sutis e amigáveis:
*   **Cartões de Nós (Nós do Fluxo)**: Devem utilizar `{rounded.md}` (`12px`) para balancear presença visual e suavidade.
*   **Botões e Inputs**: Utilizam o valor padrão `{rounded.DEFAULT}` (`8px`).
*   **Avatares ou Conectores**: Devem utilizar `{rounded.full}` para criar círculos perfeitos.

## Components

Os elementos de interface fundamentais do Flowbuilder são mapeados da seguinte forma:

1.  **Cartão de Nó (`card-node`)**:
    *   Fundo branco puro (`#FFFFFF`).
    *   Borda sutil de `1px` com a cor `{colors.outline}` (`#E7E7E9`).
    *   Cantos arredondados de `12px` (`{rounded.md}`).
2.  **Botão Principal (`button-primary`)**:
    *   Cor de fundo `{colors.primary}` (`#2781F6`).
    *   Texto em `{colors.on-primary}` (`#FFFFFF`) com tipografia `{typography.label-sm}`.
    *   Altura de `40px` com cantos arredondados de `8px`.
3.  **Ícone Outline (`icon-simple-outline`)**:
    *   Cor definida em `{colors.icon-outline}` (`#535659`).
    *   Desenho linear (outline) simples, com espessura de traço (`stroke-width`) de `1.5px`.

## Do's and Don'ts

### Fazer (Do)
*   **Do**: Use apenas a fonte **Inter** na tipografia oficial do projeto.
*   **Do**: Utilize o azul `{colors.primary}` (`#2781F6`) para destacar o estado selecionado de um nó ou conexão do fluxo.
*   **Do**: Adote ícones simples do tipo outline (sem preenchimento) com a cor `{colors.icon-outline}` (`#535659`).
*   **Do**: Utilize o cinza `{colors.outline}` (`#E7E7E9`) para todas as bordas estruturais comuns dos nós do fluxo.

### Não Fazer (Don't)
*   **Don't**: Não utilize ícones com estilo "solid" (preenchimento total) ou coloridos de forma diferente das definidas nos tokens.
*   **Don't**: Não misture fontes diferentes ou utilize tamanhos de fonte fora da escala tipográfica estabelecida.
*   **Don't**: Não use sombras escuras, pesadas ou com alto contraste. Toda profundidade deve ser extremamente sutil.
*   **Don't**: Não aplique bordas com cantos retos (sem arredondamento) nos componentes principais.

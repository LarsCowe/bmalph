function headingPattern(expression: string): RegExp {
  return new RegExp(`^##\\s+${expression}(?:\\s*:)?\\s*$`, "im");
}

export const PROJECT_GOALS_SECTION_PATTERNS = [
  headingPattern("Executive Summary"),
  headingPattern("Vision"),
  headingPattern("Goals"),
  headingPattern("Project Goals"),
  headingPattern("Resumo Executivo"),
  headingPattern("Resumo"),
  headingPattern("Objetivos(?: do Projeto)?"),
  headingPattern("Resumen Ejecutivo"),
  headingPattern("Resumen"),
  headingPattern("Objetivos(?: del Proyecto)?"),
] as const;

export const FUNCTIONAL_REQUIREMENTS_SECTION_PATTERNS = [
  headingPattern("Functional Requirements"),
  headingPattern("Requisitos Funcionais"),
  headingPattern("Requisitos Funcionales"),
] as const;

export const NON_FUNCTIONAL_REQUIREMENTS_SECTION_PATTERNS = [
  headingPattern("Non-Functional(?: Requirements)?"),
  headingPattern("NFR"),
  headingPattern("Quality"),
  headingPattern("Quality Attributes"),
  headingPattern("Requisitos N(?:a|\\u00E3)o Funcionais"),
  headingPattern("Qualidade"),
  headingPattern("Atributos de Qualidade"),
  headingPattern("Requisitos No Funcionales"),
  headingPattern("Calidad"),
  headingPattern("Atributos de Calidad"),
] as const;

export const PRD_SCOPE_SECTION_PATTERNS = [
  headingPattern("Scope"),
  headingPattern("Product Scope"),
  headingPattern("In Scope"),
  headingPattern("Out of Scope"),
  headingPattern("Escopo"),
  headingPattern("Em Escopo"),
  headingPattern("Fora de Escopo"),
  headingPattern("Alcance"),
  headingPattern("En Alcance"),
  headingPattern("Fuera de Alcance"),
] as const;

export const TECH_STACK_SOURCE_SECTION_PATTERNS = [
  headingPattern("Tech Stack"),
  headingPattern("Technology Stack"),
  headingPattern("Stack"),
  headingPattern("Core Architectural Decisions"),
  headingPattern("Starter Template Evaluation"),
  headingPattern("Pilha Tecnol(?:o|\\u00F3)gica"),
  headingPattern("Decis(?:o|\\u00F5)es Arquitet(?:o|\\u00F4)nicas Principais"),
  headingPattern("Pila Tecnol(?:o|\\u00F3)gica"),
  headingPattern("Decisiones Arquitect(?:o|\\u00F3)nicas Principales"),
] as const;

export function matchesAnyPattern(content: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(content));
}

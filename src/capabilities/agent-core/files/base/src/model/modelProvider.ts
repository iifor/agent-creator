export interface ModelGenerateInput {
  task: string;
  input: unknown;
  memory?: unknown[];
}

export interface ModelGenerateOutput {
  text: string;
  data?: unknown;
}

export interface ModelProvider {
  generate(input: ModelGenerateInput): Promise<ModelGenerateOutput>;
}

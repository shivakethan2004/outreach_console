type AdvisorModel = {
  id: string;
  name: string;
  inputPrice: string;
  outputPrice: string;
  priceLabel?: string;
  description: string;
  reasoning?: { enabled: boolean };
};

export const ADVISOR_MODELS: AdvisorModel[] = [
  {
    id: "Prism-ML/Ternary-Bonsai-27B",
    name: "Ternary Bonsai 27B",
    inputPrice: "Free",
    outputPrice: "Free",
    description: "Free (default)",
  },
  {
    id: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    name: "Meta Llama 3.3 70B Instruct Turbo",
    inputPrice: "",
    outputPrice: "",
    priceLabel: "$1.04 listed rate",
    description: "General-purpose",
  },
  {
    id: "deepseek-ai/DeepSeek-V4.1-Flash",
    name: "DeepSeek V4.1 Flash",
    inputPrice: "$0.30",
    outputPrice: "$1.20",
    description: "Fast",
  },
  {
    id: "Qwen/Qwen3.5-9B",
    name: "Qwen3.5 9B FP8",
    inputPrice: "$0.17",
    outputPrice: "$0.25",
    description: "Low-cost",
    reasoning: { enabled: false },
  },
  {
    id: "openai/gpt-oss-120b",
    name: "OpenAI GPT-OSS 120B",
    inputPrice: "$0.15",
    outputPrice: "$0.60",
    description: "General-purpose",
    reasoning: { enabled: false },
  },
];

export const DEFAULT_ADVISOR_MODEL = ADVISOR_MODELS[0].id;

export function isAdvisorModel(value: unknown): value is string {
  return ADVISOR_MODELS.some((model) => model.id === value);
}

export function getAdvisorModel(value: string) {
  return ADVISOR_MODELS.find((model) => model.id === value);
}

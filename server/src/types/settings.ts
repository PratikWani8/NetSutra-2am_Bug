import { SupportedProvider } from './investigation';

export interface AiProviderSettings {
  selected_provider: SupportedProvider;
  available_providers: SupportedProvider[];
  updated_at: string;
}

export interface SingleProviderStatus {
  configured: boolean;
  available: boolean;
  model?: string | null;
  endpoint?: string | null;
  message: string;
  latency_ms?: number | null;
}

export interface ProvidersStatusResponse {
  providers: Record<string, SingleProviderStatus>;
  timestamp: string;
}

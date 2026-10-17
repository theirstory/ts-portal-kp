import weaviate, { WeaviateClient } from 'weaviate-client';

let client: WeaviateClient | null = null;

// The startup gRPC health check defaults to 2s, which a remote Weaviate (e.g. through an ssh tunnel)
// can exceed; a slow first check shouldn't fail the request.
const timeout = { init: 15, query: 60, insert: 120 };

function isLocalWeaviate(host?: string) {
  return host === 'localhost' || host === '127.0.0.1' || host === 'weaviate';
}

export async function initWeaviateClient() {
  const httpHost = process.env.WEAVIATE_HOST_URL ?? 'localhost';
  const httpPort = Number(process.env.WEAVIATE_PORT ?? 8080);

  const grpcHost = process.env.WEAVIATE_GRPC_HOST_URL ?? httpHost;
  const grpcPort = Number(process.env.WEAVIATE_GRPC_PORT ?? 50051);

  const adminKey = process.env.WEAVIATE_ADMIN_KEY ?? '';

  const local = isLocalWeaviate(httpHost);

  console.log('envs', {
    WEAVIATE_PORT: httpPort,
    WEAVIATE_HOST_URL: httpHost,
    WEAVIATE_GRPC_PORT: grpcPort,
    WEAVIATE_GRPC_HOST_URL: grpcHost,
    WEAVIATE_ADMIN_KEY: adminKey ? '****' : null,
    isLocal: local,
    vectorizer: 'local-embeddings',
  });

  if (!client) {
    if (local) {
      client = await weaviate.connectToCustom({
        httpHost,
        httpPort,
        grpcHost,
        grpcPort,
        timeout,
      });
      return client;
    }

    client = await weaviate.connectToCustom({
      httpHost,
      httpPort,
      grpcHost,
      grpcPort,
      timeout,
      ...(adminKey ? { authCredentials: new weaviate.ApiKey(adminKey) } : {}),
    });
  }

  return client;
}

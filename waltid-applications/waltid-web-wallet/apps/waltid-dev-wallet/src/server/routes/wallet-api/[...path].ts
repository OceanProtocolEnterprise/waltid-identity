export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const path = getRouterParam(event, 'path') || '';
  const targetUrl = `${config.walletApiInternal}/${path}`;

  return proxyRequest(event, targetUrl);
});
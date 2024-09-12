// workers.dev/index.js
export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  }
}

const getTargetKey = (host, rootDomain) => {
  return host.split(`.${rootDomain}`)[0].split("-proxy")[0]; 
}

const isNull = (data) => {
  if (!data || data == undefined || data == null || data == 'undefined' || data == 'null' || data == '[]' || data == '""' || data == '') {
    return true;
  }
  return false;
}

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const { host, pathname } = url;

  if (pathname === '/robots.txt') {
    const robots = `User-agent: *
Disallow: /
    `;
   return new Response(robots,{ status: 200 });
  }

  const ownDomain = env.OWN_DOMAIN ? env.OWN_DOMAIN : "serp.ing";
  const targetKey = getTargetKey(host, ownDomain);
  const targetDomain = await env.KV.get(targetKey);
  if (isNull(targetDomain)) {
    return new Response('Page not found', { status: 404 });
  }
  const origin = `https://${targetDomain}`; 
  const actualUrl = new URL(`${origin}${pathname}${url.search}${url.hash}`); 

  const modifiedRequestInit = {
    method: request.method,
    headers: request.headers,
    redirect: 'follow'
  };

  if (!['GET', 'HEAD'].includes(request.method)) {
    const requestBody = await request.clone().arrayBuffer();
    modifiedRequestInit.body = requestBody;
  }

  const modifiedRequest = new Request(actualUrl, modifiedRequestInit);

  const response = await fetch(modifiedRequest);

  let body = await response.arrayBuffer();
  const contentType = response.headers.get('content-type');

  // Check if the 'content-type' exists and matches JavaScript or any text/* types (e.g., text/html, text/xml)
  if (contentType && ( /^(application\/x-javascript|text\/)/i.test(contentType))) {
    let text = new TextDecoder('utf-8').decode(body);

    // Replace all instances of the proxy site domain with the current host domain in the text
    text = text.replace(new RegExp( `(//|https?://)${targetDomain}`, 'g'), `$1${host}` );
    body = new TextEncoder().encode(text).buffer;
  }

  const modifiedResponse = new Response(body, response);
  modifiedResponse.headers.set('Access-Control-Allow-Origin', '*');
  return modifiedResponse; 
 
}

import { createHmac, randomBytes } from "node:crypto";

export type NeuroAccount = "appraiser" | "borrower";

type Credentials = {
  userName: string;
  password: string;
  legalId: string;
  keyId: string;
  keyPassword: string;
  keyLocalName: string;
  keyNamespace: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function host(): string {
  return requireEnv("NEURO_HOST");
}

export function credentials(account: NeuroAccount): Credentials {
  const p = `NEURO_${account.toUpperCase()}_`;
  return {
    userName: requireEnv(`${p}USERNAME`),
    password: requireEnv(`${p}PASSWORD`),
    legalId: requireEnv(`${p}LEGAL_ID`),
    keyId: requireEnv(`${p}KEY_ID`),
    keyPassword: requireEnv(`${p}KEY_PASSWORD`),
    keyLocalName: requireEnv(`${p}KEY_LOCAL_NAME`),
    keyNamespace: requireEnv(`${p}KEY_NAMESPACE`),
  };
}

function hmac(key: string, data: string): string {
  return createHmac("sha256", key).update(data).digest("base64");
}

async function request<T>(path: string, body: unknown, jwt?: string): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Referer: requireEnv("NEURO_REFERER"),
  };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;

  const res = await fetch(`https://${host()}/Agent/${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Neuro ${path} failed: ${res.status} ${text}`);
  return JSON.parse(text) as T;
}

// ---------- Session ----------

const sessions = new Map<NeuroAccount, { jwt: string; expires: number }>();

async function jwtFor(account: NeuroAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const cached = sessions.get(account);
  if (cached && cached.expires - now > 60) return cached.jwt;

  const c = credentials(account);
  const nonce = randomBytes(32).toString("hex");
  const signature = hmac(c.password, `${c.userName}:${host()}:${nonce}`);

  const data = await request<{ jwt: string; expires: number }>("Account/Login", {
    userName: c.userName,
    nonce,
    signature,
    seconds: 3600,
  });

  sessions.set(account, data);
  return data.jwt;
}

async function call<T>(account: NeuroAccount, path: string, body: unknown = {}): Promise<T> {
  return request<T>(path, body, await jwtFor(account));
}

// ---------- Legal ----------

export type NeuroIdentity = {
  id: string;
  status: { state: string; from?: string; to?: string };
  property?: { name: string; value: string } | { name: string; value: string }[];
};

export async function getIdentities(account: NeuroAccount): Promise<NeuroIdentity[]> {
  const data = await call<{ Identities?: NeuroIdentity[] }>(account, "Legal/GetIdentities", {
    offset: 0,
    maxCount: 10,
  });
  return data.Identities ?? [];
}

export type NeuroContract = {
  id: string;
  status: { state: string; templateId?: string; from?: string; to?: string };
  [key: string]: unknown;
};

export async function proposeTemplate(account: NeuroAccount, xml: string): Promise<NeuroContract> {
  const templateBase64 = Buffer.from(xml, "utf8").toString("base64");
  const data = await call<{ Template: NeuroContract }>(account, "Legal/ProposeTemplate", {
    templateBase64,
  });
  return data.Template;
}

export async function getContract(account: NeuroAccount, contractId: string): Promise<NeuroContract> {
  const data = await call<{ Contract: NeuroContract }>(account, "Legal/GetContract", { contractId });
  return data.Contract;
}

export type ContractPart = { role: string; legalId: string };
export type ContractParameter = { name: string; value: string | number };

export async function createContract(
  account: NeuroAccount,
  templateId: string,
  parts: ContractPart[],
  parameters: ContractParameter[],
): Promise<NeuroContract> {
  const data = await call<{ Contract: NeuroContract }>(account, "Legal/CreateContract", {
    templateId,
    visibility: "CreatorAndParts",
    Parts: parts,
    Parameters: parameters,
  });
  return data.Contract;
}

export async function signContract(account: NeuroAccount, contractId: string, role: string): Promise<void> {
  const c = credentials(account);
  const nonce = randomBytes(32).toString("base64");
  const s1 = [c.userName, host(), c.keyLocalName, c.keyNamespace, c.keyId].join(":");
  const keySignature = hmac(c.keyPassword, s1);
  const s2 = [s1, keySignature, nonce, c.legalId, contractId, role].join(":");
  const requestSignature = hmac(c.password, s2);

  await call(account, "Legal/SignContract", {
    keyId: c.keyId,
    legalId: c.legalId,
    contractId,
    role,
    nonce,
    keySignature,
    requestSignature,
  });
}

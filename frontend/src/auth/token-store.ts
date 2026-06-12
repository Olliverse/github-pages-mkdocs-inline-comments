export interface TokenProvider {
  get(): string | null;
  set(token: string): void;
  clear(): void;
}

export class LocalStorageTokenProvider implements TokenProvider {
  private readonly key: string;

  constructor(apiBaseUrl: string) {
    this.key = `ghc:token:${new URL(apiBaseUrl).host}`;
  }

  get(): string | null {
    try {
      return localStorage.getItem(this.key);
    } catch {
      return null;
    }
  }

  set(token: string): void {
    try {
      localStorage.setItem(this.key, token);
    } catch {
      return;
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(this.key);
    } catch {
      return;
    }
  }
}

export class StaticTokenProvider implements TokenProvider {
  constructor(private readonly token: string) {}

  get(): string | null {
    return this.token;
  }

  set(): void {
    return;
  }

  clear(): void {
    return;
  }
}

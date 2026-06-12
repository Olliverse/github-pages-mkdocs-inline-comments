import { button, el, errorText, link } from "./dom";

export interface TokenFormOptions {
  tokenUrl: string | null;
  onSubmit(token: string): Promise<void>;
}

export function createTokenForm(opts: TokenFormOptions): HTMLElement {
  const form = el("form", "ghc-token-form");
  form.appendChild(
    el(
      "p",
      "ghc-token-form__intro",
      "Sign in with a fine-grained personal access token scoped to the docs repository with Issues read/write.",
    ),
  );
  if (opts.tokenUrl) {
    const p = el("p", "ghc-token-form__link");
    p.appendChild(link(opts.tokenUrl, "Create a token"));
    form.appendChild(p);
  }
  const input = el("input", "ghc-input");
  input.type = "password";
  input.placeholder = "github_pat_...";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("aria-label", "Personal access token");
  form.appendChild(input);
  const error = el("p", "ghc-error");
  error.hidden = true;
  const submit = button("Sign in", "ghc-button ghc-button--primary", () => form.requestSubmit());
  submit.type = "submit";
  form.appendChild(submit);
  form.appendChild(error);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const token = input.value.trim();
    if (!token || submit.disabled) return;
    submit.disabled = true;
    error.hidden = true;
    opts
      .onSubmit(token)
      .catch((e: unknown) => {
        error.textContent = errorText(e);
        error.hidden = false;
      })
      .finally(() => {
        submit.disabled = false;
      });
  });
  return form;
}

import appIconUrl from "../../src-tauri/icons/app-icon.svg";

export function AppMark() {
  return <img className="app-mark" src={appIconUrl} alt="" aria-hidden="true" />;
}

export function SourceArtwork() {
  return (
    <svg className="source-artwork" viewBox="0 0 320 150" aria-hidden="true">
      <path className="art-plane back" d="M22 22h198l42 34v88H22z" />
      <path className="art-plane front" d="M48 8h204l40 40v108H48z" />
      <path className="art-fold" d="M252 8v40h40" />
      <path
        className="art-wave rough"
        d="M74 92c10-42 19-42 29 0s19 42 29 0 19-42 29 0"
      />
      <path
        className="art-wave clear"
        d="M170 92c15-54 31-54 46 0 10 34 20 34 30 0"
      />
      <path className="art-divider" d="M158 54v82" />
      <path className="art-badge" d="M78 31h82v24H78z" />
      <path className="art-spark" d="m260 76 5 13 13 5-13 5-5 13-5-13-13-5 13-5 5-13Z" />
    </svg>
  );
}

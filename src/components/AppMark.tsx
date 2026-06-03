export function AppMark() {
  return (
    <svg className="app-mark" viewBox="0 0 96 96" aria-hidden="true">
      <rect x="5" y="5" width="86" height="86" rx="16" />
      <path className="mark-field" d="M18 23h60v48H18z" />
      <path className="mark-shadow" d="M26 72h52v8H26z" />
      <path
        className="mark-rough"
        d="M22 50c5-14 10-14 15 0s10 14 15 0"
      />
      <path
        className="mark-clear"
        d="M48 50c7-18 14-18 21 0 3 8 6 10 9 8"
      />
      <path className="mark-capsule" d="M25 30h46c7 0 13 6 13 13s-6 13-13 13H25z" />
      <path className="mark-spark" d="m72 18 3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8Z" />
    </svg>
  );
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

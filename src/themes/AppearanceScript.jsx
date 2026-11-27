// src/theme/AppearanceScript.jsx

import {
  APPEARANCE_SCRIPT,
} from "./appearanceScript";

export default function AppearanceScript({
  nonce,
}) {
  return (
    <script
      id="messenger-appearance-script"
      nonce={nonce}
      dangerouslySetInnerHTML={{
        __html: APPEARANCE_SCRIPT,
      }}
    />
  );
}
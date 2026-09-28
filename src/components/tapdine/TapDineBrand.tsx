import logoAsset from "@/assets/tapdine-logo.png.asset.json";

export function TapDineBrand() {
  return (
    <img src={logoAsset.url} alt="TapDine" width={1024} height={1024} className="h-14 w-auto object-contain object-left" />
  );
}
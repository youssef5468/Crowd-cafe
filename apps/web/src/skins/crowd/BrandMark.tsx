import { brand } from './brand';

export function BrandMark() {
  return (
    <>
      <img className="crowd-logo" src={brand.assets.logo} width="120" height="47" alt="" />
      <span className="sr-only">{brand.name}</span>
    </>
  );
}

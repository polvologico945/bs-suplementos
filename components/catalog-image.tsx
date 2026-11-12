/* eslint-disable @next/next/no-img-element -- URL única pré-comprimida evita transformações pagas por tamanho. */
"use client";
import { memo, type ImgHTMLAttributes } from "react";
import { mediaUrl } from "@/lib/media";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src?: string | null;
};
export const CatalogImage = memo(function CatalogImage({
  src,
  alt = "",
  loading = "lazy",
  ...props
}: Props) {
  return (
    <img
      {...props}
      src={mediaUrl(src)}
      alt={alt}
      loading={loading}
      decoding="async"
      onError={(event) => {
        if (!event.currentTarget.src.endsWith("/brand/logo-card.jpg"))
          event.currentTarget.src = "/brand/logo-card.jpg";
      }}
    />
  );
});

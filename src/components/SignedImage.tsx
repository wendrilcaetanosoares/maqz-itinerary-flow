import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SignedImageProps {
  path: string;
  alt: string;
  className?: string;
  bucket?: string;
}

export function SignedImage({ path, alt, className, bucket = "machine-photos" }: SignedImageProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function getUrl() {
      // If it's already a full URL (legacy data), use as-is
      if (path.startsWith("http")) {
        setUrl(path);
        return;
      }
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 3600);
      if (!cancelled && data?.signedUrl) {
        setUrl(data.signedUrl);
      }
    }

    getUrl();
    return () => { cancelled = true; };
  }, [path, bucket]);

  if (!url) return null;

  return <img src={url} alt={alt} className={className} />;
}

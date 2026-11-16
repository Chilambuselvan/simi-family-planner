import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export function useItemPhotoUrl(path: string | null) {
  return useQuery({
    queryKey: ["photo", path],
    enabled: !!path,
    staleTime: 1000 * 60 * 50,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("item-photos").createSignedUrl(path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

export function ItemPhoto({ path, alt, className }: { path: string | null; alt: string; className?: string }) {
  const { data } = useItemPhotoUrl(path);
  return (
    <div className={cn("flex items-center justify-center overflow-hidden bg-secondary text-secondary-foreground", className)}>
      {data ? <img src={data} alt={alt} className="size-full object-cover" /> : <Package className="size-1/3 opacity-50" />}
    </div>
  );
}

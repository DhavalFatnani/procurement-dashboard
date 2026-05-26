import type { ComponentProps } from "react";

import { VendorsView } from "@/components/vendors/VendorsView";

export function VendorsTableSection(props: ComponentProps<typeof VendorsView>) {
  return <VendorsView {...props} showHeader={false} />;
}

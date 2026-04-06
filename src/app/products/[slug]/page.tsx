import { PagePlaceholder } from "@/components/shared/page-placeholder";

type ProductDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { slug } = await params;

  return <PagePlaceholder eyebrow={slug} title="Product Detail" />;
}

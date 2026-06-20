import { getCachedIndex } from "@/lib/fetchIndex";
import FavoritesList from "@/components/FavoritesList";

export default async function FavoritesPage() {
  const index = await getCachedIndex();
  return <FavoritesList allFiles={index.files} />;
}

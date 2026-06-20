"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export type SortKey = "name-asc" | "name-desc" | "date-desc" | "date-asc" | "size-desc" | "size-asc";

const OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name-asc",   label: "이름순 (가나다)" },
  { value: "name-desc",  label: "이름 역순" },
  { value: "date-desc",  label: "최신순" },
  { value: "date-asc",   label: "오래된순" },
  { value: "size-desc",  label: "크기 큰순" },
  { value: "size-asc",   label: "크기 작은순" },
];

interface Props {
  value: SortKey;
}

export default function SortSelect({ value }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", e.target.value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <select
      value={value}
      onChange={handleChange}
      className="text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl px-3 py-1.5 outline-none focus:border-blue-400 dark:focus:border-blue-500 cursor-pointer transition-colors"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

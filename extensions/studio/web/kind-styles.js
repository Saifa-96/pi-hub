/* kind 维度的 Tailwind 类映射：类名必须静态可扫描，禁止运行时拼接 */

export const KIND_CARD_BORDER = {
	frontend: "border-l-emerald-600",
	backend: "border-l-blue-600",
	database: "border-l-amber-600",
	external: "border-l-violet-600",
};

export const KIND_GROUP_BORDER = {
	frontend: "border-emerald-300",
	backend: "border-blue-300",
	database: "border-amber-300",
	external: "border-violet-300",
};

export const KIND_TEXT = {
	frontend: "text-emerald-600",
	backend: "text-blue-600",
	database: "text-amber-600",
	external: "text-violet-600",
};

export const KIND_BADGE = {
	frontend: "border-emerald-600 text-emerald-600",
	backend: "border-blue-600 text-blue-600",
	database: "border-amber-600 text-amber-600",
	external: "border-violet-600 text-violet-600",
};

export function pickKind(map, kind) {
	return map[kind] ?? map.backend;
}

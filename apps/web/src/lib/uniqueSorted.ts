/** 去重並依中文排序,類別/菜系下拉選單與候選清單共用同一份順序 */
export function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'zh-Hant'));
}

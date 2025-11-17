/**
 * SQLite-compatible bulk create with duplicate handling
 *
 * SQLite doesn't support skipDuplicates in createMany, so this function
 * creates records individually and ignores unique constraint violations.
 */
export async function createManyIgnoreDuplicates<T extends { create: (args: any) => Promise<any> }>(
  model: T,
  data: any[]
): Promise<void> {
  for (const item of data) {
    try {
      await model.create({ data: item });
    } catch (error: any) {
      // Ignore duplicate errors (P2002 = unique constraint violation)
      if (error.code !== 'P2002') {
        throw error;
      }
    }
  }
}

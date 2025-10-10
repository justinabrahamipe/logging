import { prisma } from "../lib/prisma";

async function testConnection() {
  try {
    console.log("Testing database connection...");

    // Test connection by running a simple query
    await prisma.$connect();
    console.log("✅ Successfully connected to the database!");

    // Get counts of each table
    const activityCount = await prisma.activity.count();
    const logCount = await prisma.log.count();
    const todoCount = await prisma.todo.count();

    console.log("\nDatabase statistics:");
    console.log(`- Activities: ${activityCount}`);
    console.log(`- Logs: ${logCount}`);
    console.log(`- Todos: ${todoCount}`);

    await prisma.$disconnect();
    console.log("\n✅ Database connection test completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Database connection failed:");
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

testConnection();

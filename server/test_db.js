const prisma = require('./src/config/db');

async function test() {
  console.log('Testing prisma query...');
  try {
    const userCount = await prisma.user.count();
    console.log('User count:', userCount);
    
    const group = await prisma.group.findFirst();
    console.log('Group:', group);
    
    if (group) {
      console.log('Attempting to create expense...');
      const exp = await prisma.expense.create({
        data: {
          groupId: group.id,
          title: 'Test',
          totalAmount: 100,
          paidBy: group.createdBy,
          splitMethod: 'EQUAL',
          category: 'General',
          createdBy: group.createdBy,
          isSettled: true,
          splits: {
            create: [
              {
                userId: group.createdBy,
                owedAmount: 100,
                percentage: 100
              }
            ]
          }
        }
      });
      console.log('Expense created:', exp);
    } else {
      console.log('No group found to test expense creation');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

test();

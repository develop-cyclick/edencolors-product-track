import { NextRequest } from 'next/server';
import { withManager } from '@/lib/api-middleware';
import { successResponse, errors } from '@/lib/api-response';
import type { JWTPayload } from '@/lib/auth';
import { getProductStats, getCategoryStats } from '@/lib/analytics-queries';
import prisma from '@/lib/prisma';

type HandlerContext = { user: JWTPayload };

// GET /api/analytics/products - Get product analytics
async function handleGET(request: NextRequest, _context: HandlerContext) {
  try {
    const { searchParams } = request.nextUrl;
    const categoryId = searchParams.get('categoryId');
    const activationType = searchParams.get('activationType');

    // Fetch product stats and category stats
    const [products, categories] = await Promise.all([
      getProductStats(),
      getCategoryStats(),
    ]);

    // Filter products if needed
    let filteredProducts = products;

    if (categoryId) {
      const categoryIdNum = parseInt(categoryId);
      if (!isNaN(categoryIdNum)) {
        // Filter by category through product master
        filteredProducts = products.filter(
          (p) => p.categoryNameTh === categories.find((c) => c.categoryId === categoryIdNum)?.categoryNameTh
        );
      }
    }

    if (activationType) {
      filteredProducts = filteredProducts.filter(
        (p) => p.activationType === activationType
      );
    }

    // Get all categories for filter dropdown
    const allCategories = await prisma.productCategory.findMany({
      where: { isActive: true },
      select: {
        id: true,
        nameTh: true,
        nameEn: true,
      },
      orderBy: { nameTh: 'asc' },
    });

    return successResponse({
      products: filteredProducts,
      categories,
      allCategories,
    });
  } catch (error) {
    console.error('Product analytics error:', error);
    return errors.internalError();
  }
}

export const GET = withManager(handleGET);

import React, { useState, useRef } from 'react';
import {
  Package,
  Search,
  Plus,
  Edit2,
  Trash2,
  X
} from 'lucide-react';
import { Product } from '../types';
import { useAppDialogs } from './AppDialogProvider';

interface ProductsViewProps {
  products: Product[];
  onAddProduct: (prod: Omit<Product, 'id'>) => void;
  onUpdateProduct: (prod: Product) => void;
  onDeleteProduct: (id: string) => void;
  onAdjustStock: (id: string, delta: number) => void;
}

export const ProductsView: React.FC<ProductsViewProps> = ({
  products,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onAdjustStock
}) => {
  const { showConfirm } = useAppDialogs();
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formCategory, setFormCategory] = useState<Product['category']>('كابلات');
  const [formUnit, setFormUnit] = useState('بكرة');
  const [formPrice, setFormPrice] = useState(35000);
  const [formStock, setFormStock] = useState(20);
  const [formDescription, setFormDescription] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');

  const imageFileInputRef = useRef<HTMLInputElement>(null);

  const categories = ['الكل', 'أريل', 'كابلات', 'ريمونت', 'فيش', 'أجهزة جديدة', 'أجهزة مستعملة'];

  const filteredProducts = products.filter((p) => {
    if (selectedCategory !== 'الكل' && p.category !== selectedCategory) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        p.name.toLowerCase().includes(term) ||
        p.code.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const handleOpenAdd = () => {
    setFormName('');
    setFormCode(`PRD-0${products.length + 1}`);
    setFormCategory('أجهزة جديدة');
    setFormUnit('قطعة');
    setFormPrice(45000);
    setFormStock(20);
    setFormDescription('منتج أصلي معتمد لبث الساري وقنوات الرابعة الرياضية');
    setFormImageUrl('https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&w=600&q=80');
    setShowAddModal(true);
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formCode.trim()) return;

    onAddProduct({
      code: formCode.trim(),
      name: formName.trim(),
      category: formCategory,
      unit: formUnit.trim() || 'قطعة',
      price: formPrice,
      stock: formStock,
      description: formDescription.trim() || 'منتج أصلي معتمد لبث الساري وقنوات الرابعة الرياضية',
      imageUrl: formImageUrl.trim() || 'https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&w=600&q=80'
    });

    setShowAddModal(false);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormCode(p.code);
    setFormCategory(p.category);
    setFormUnit(p.unit || (p.category === 'كابلات' ? 'بكرة' : 'قطعة'));
    setFormPrice(p.price);
    setFormStock(p.stock);
    setFormDescription(p.description);
    setFormImageUrl(p.imageUrl);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    onUpdateProduct({
      ...editingProduct,
      name: formName.trim(),
      code: formCode.trim(),
      category: formCategory,
      unit: formUnit.trim() || 'قطعة',
      price: formPrice,
      stock: formStock,
      description: formDescription.trim(),
      imageUrl: formImageUrl.trim()
    });

    setEditingProduct(null);
  };

  const handleUploadImageFromComputer = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setFormImageUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      {/* Category Pills & Search Filter Bar matching Screenshot 5 */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث باسم المنتج، الرمز، أو الفئة..."
            className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
          />
        </div>

        {/* Categories Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-slate-500 ml-1">الفئة:</span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${
                selectedCategory === cat
                  ? 'bg-sky-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{cat}</span>
              {cat === 'الكل' && <span className="text-[10px]">📁</span>}
            </button>
          ))}
        </div>

        {/* Add Product Button */}
        <button
          onClick={handleOpenAdd}
          className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة منتج جديد</span>
        </button>
      </div>

      {/* Products Grid matching Screenshot 5 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {filteredProducts.map((prod) => (
          <div
            key={prod.id}
            className="bg-white rounded-3xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group hover:border-sky-300"
          >
            <div>
              {/* Product Image Container with Badges */}
              <div className="relative h-44 bg-slate-100 overflow-hidden flex items-center justify-center">
                <img
                  src={prod.imageUrl}
                  alt={prod.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* Stock Badge (Top Left in RTL) */}
                <div className="absolute top-2.5 right-2.5">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-600/90 text-white font-bold text-[10px] shadow-sm backdrop-blur-xs">
                    متوفر ({prod.stock} {prod.unit || 'قطعة'})
                  </span>
                </div>

                {/* Category Pill (Top Right in RTL) */}
                <div className="absolute top-2.5 left-2.5">
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-900/80 text-white font-bold text-[10px] backdrop-blur-xs">
                    {prod.category}
                  </span>
                </div>
              </div>

              {/* Product Info */}
              <div className="p-4">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span className="font-mono font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100">
                    {prod.code}
                  </span>
                </div>

                <h4 className="font-extrabold text-slate-900 text-sm leading-snug h-10 line-clamp-2">
                  {prod.name}
                </h4>

                <p className="mt-1 text-[11px] text-slate-500 line-clamp-2 h-8 leading-relaxed">
                  {prod.description}
                </p>

                {/* Pricing & Stock Details */}
                <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="p-2 rounded-xl bg-slate-50">
                    <div className="text-[10px] text-slate-400">سعر المفرد</div>
                    <div className="font-black text-sky-900 mt-0.5">
                      {prod.price.toLocaleString()} <span className="text-[9px]">د.ع</span>
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-50">
                    <div className="text-[10px] text-slate-400">الكمية في المخزن</div>
                    <div className="font-black text-slate-800 mt-0.5">
                      {prod.stock} <span className="text-[9px]">{prod.unit || 'قطعة'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stock Controls & Actions matching Screenshot 5 */}
            <div className="p-4 pt-0">
              <div className="flex items-center justify-between gap-1 pt-3 border-t border-slate-100 text-xs">
                {/* Delete */}
                <button
                  onClick={async () => {
                    if (await showConfirm(`هل تريد حذف المنتج "${prod.name}"؟`, 'حذف المنتج')) {
                      onDeleteProduct(prod.id);
                    }
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="حذف المنتج"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                {/* Edit Button */}
                <button
                  onClick={() => handleOpenEdit(prod)}
                  className="px-2.5 py-1 rounded-lg text-slate-600 hover:bg-slate-100 font-bold flex items-center gap-1 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                  <span>تعديل</span>
                </button>

                {/* Quick Stock Increments (+ / -) matching Screenshot 5 */}
                <div className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded-xl border border-slate-200">
                  <button
                    onClick={() => onAdjustStock(prod.id, 1)}
                    className="w-5 h-5 rounded-md bg-white hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700"
                    title="زيادة قطعة"
                  >
                    +
                  </button>
                  <span className="font-bold text-[11px] px-1 text-slate-800">{prod.stock}</span>
                  <button
                    onClick={() => onAdjustStock(prod.id, -1)}
                    disabled={prod.stock <= 0}
                    className="w-5 h-5 rounded-md bg-white hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700 disabled:opacity-40"
                    title="إنقاص قطعة"
                  >
                    -
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Edit Product & Inventory Data matching the user screenshot */}
      {(editingProduct || showAddModal) && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in" dir="rtl">
          <div className="bg-[#0C1327] rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-[#1A2647] max-h-[95vh] overflow-y-auto">
            {/* Modal Header matching Screenshot */}
            <div className="flex items-center justify-between pb-4 border-b border-[#1A2647]">
              <h3 className="font-extrabold text-lg text-white tracking-tight">
                {editingProduct ? 'تعديل بيانات المنتج والمخزن' : 'إضافة منتج جديد للمخزن'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditingProduct(null);
                  setShowAddModal(false);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={editingProduct ? handleSaveEdit : handleSaveAdd} className="mt-5 space-y-4 text-xs">
              {/* Row 1: اسم المنتج * & رمز / كود المنتج * */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-200 mb-1.5">اسم المنتج *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="كابل RG6 نحاسي أصلي (بكرة 100م)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#091024] border border-[#1E2C52] text-white font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-200 mb-1.5">رمز / كود المنتج *</label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="CAB-01"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#091024] border border-[#1E2C52] text-white font-mono font-bold text-center focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* Row 2: فئة المنتج * & وحدة القياس */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-200 mb-1.5">فئة المنتج *</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#091024] border border-[#1E2C52] text-white font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                  >
                    <option value="كابلات">كابلات</option>
                    <option value="أريل">أريل</option>
                    <option value="ريمونت">ريمونت</option>
                    <option value="فيش">فيش</option>
                    <option value="أجهزة جديدة">أجهزة جديدة</option>
                    <option value="أجهزة مستعملة">أجهزة مستعملة</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-200 mb-1.5">وحدة القياس</label>
                  <input
                    type="text"
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    placeholder="بكرة"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#091024] border border-[#1E2C52] text-white font-medium text-center focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* Row 3: سعر القطعة المفرد (د.ع) * & الكمية المتوفرة في المخزن * */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-200 mb-1.5">سعر القطعة المفرد (د.ع) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={formPrice}
                    onChange={(e) => setFormPrice(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#091024] border border-[#1E2C52] text-sky-400 font-mono font-bold text-base text-center focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <span className="block text-[11px] text-slate-400 mt-1">
                    السعر المعروض للبيع المفرد بالدينار العراقي
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-200 mb-1.5">الكمية المتوفرة في المخزن *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={formStock}
                    onChange={(e) => setFormStock(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#091024] border border-[#1E2C52] text-white font-mono font-bold text-base text-center focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <span className="block text-[11px] text-slate-400 mt-1">
                    الرصيد الفعلي المتوفر في المخزن الرئيسي
                  </span>
                </div>
              </div>

              {/* Row 4: صورة المنتج matching Screenshot */}
              <div className="space-y-2">
                <label className="block font-bold text-slate-200">صورة المنتج</label>
                <div className="flex flex-wrap items-center gap-3">
                  {/* Thumbnail */}
                  {formImageUrl ? (
                    <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-700 bg-black flex items-center justify-center shadow-inner">
                      <img
                        src={formImageUrl}
                        alt="صورة المنتج"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-xl border border-dashed border-slate-700 bg-[#091024] flex items-center justify-center text-slate-500 text-[10px]">
                      لا توجد صورة
                    </div>
                  )}

                  {/* Delete image button */}
                  {formImageUrl && (
                    <button
                      type="button"
                      onClick={() => setFormImageUrl('')}
                      className="px-3 py-1.5 rounded-xl border border-red-900/60 bg-[#1E0D16] hover:bg-red-950/40 text-red-400 font-bold text-xs transition-colors"
                    >
                      حذف الصورة
                    </button>
                  )}

                  {/* Upload button from laptop */}
                  <label className="px-4 py-2 rounded-xl bg-[#142347] hover:bg-[#1A2E5C] border border-[#233870] text-sky-200 font-bold text-xs cursor-pointer flex items-center gap-1.5 transition-colors shadow-xs active:scale-95">
                    <span>تحميل صورة من لابتوبي</span>
                    <span>📁</span>
                    <input
                      ref={imageFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleUploadImageFromComputer}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Row 5: مواصفات وملاحظات المنتج */}
              <div>
                <label className="block font-bold text-slate-200 mb-1.5">مواصفات وملاحظات المنتج</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="سلك توصيل محوري نحاسي عالي التوصيل ومقاوم للعوامل الجوية"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#091024] border border-[#1E2C52] text-white text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-sky-500 min-h-[75px]"
                />
              </div>

              {/* Bottom Actions Bar */}
              <div className="pt-3 flex items-center justify-start gap-2.5 border-t border-[#1A2647]">
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#207E9C] hover:bg-[#1A6C86] text-white font-bold text-xs shadow-md transition-all active:scale-95"
                >
                  حفظ التعديلات والمزامنة
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingProduct(null);
                    setShowAddModal(false);
                  }}
                  className="px-6 py-2.5 rounded-xl bg-[#101A38] hover:bg-[#16234B] border border-[#203260] text-slate-300 font-bold text-xs transition-all"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

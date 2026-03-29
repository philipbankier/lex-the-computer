export default function BillingPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Billing</h1>
      <div className="text-center py-16">
        <div className="text-4xl mb-3 opacity-30">💳</div>
        <p className="opacity-60 mb-3">No billing configured</p>
        <p className="text-sm opacity-40">Lex is self-hosted and free to use. Billing features will be available in multi-user mode.</p>
      </div>
    </div>
  );
}

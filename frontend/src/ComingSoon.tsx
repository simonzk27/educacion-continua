import { Construction } from 'lucide-react'

export default function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-300 py-24 text-center dark:border-gray-700">
      <Construction className="h-8 w-8 text-gray-400 dark:text-gray-600" />
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Este módulo está en construcción.
      </p>
    </div>
  )
}

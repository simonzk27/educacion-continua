import { useEffect, useMemo, useState } from 'react'
import { collection, collectionGroup, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from './firebase'
import {
  type Dia,
  type Modo,
  addDays,
  formatFechaSesion,
  formatHora,
  ocurrenciasEntre,
  todayIso,
} from './scheduleUtils'

type Curso = {
  id: string
  nombre: string
  duracionValor: number
  duracionUnidad: string
}

type Horario = {
  cursoId: string
  modo: Modo
  dias: Dia[]
  fechas: string[]
  hora: string | null
  vigenciaInicio: string | null
  vigenciaFin: string | null
}

type Avance = {
  id: string
  fecha: string
  cursoId: string
  lecciones: number
  aprendizaje: string
}

type MiPanelProps = {
  readonly nombre: string | null
  readonly userId: string
  readonly onRegistrarAvance: () => void
}

export default function MiPanel({ nombre, userId, onRegistrarAvance }: MiPanelProps) {
  const primerNombre = nombre?.split(' ')[0] ?? 'Usuario'

  const [cursosPorId, setCursosPorId] = useState<Record<string, Curso>>({})
  const [cursoIds, setCursoIds] = useState<string[]>([])
  const [horariosPorCurso, setHorariosPorCurso] = useState<Record<string, Horario>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onSnapshot(collection(db, 'cursos'), (snap) => {
      const map: Record<string, Curso> = {}
      snap.docs.forEach((d) => {
        const data = d.data()
        map[d.id] = {
          id: d.id,
          nombre: (data.nombre as string) ?? d.id,
          duracionValor: (data.duracionValor as number) ?? 0,
          duracionUnidad: (data.duracionUnidad as string) ?? '',
        }
      })
      setCursosPorId(map)
    })
  }, [])

  useEffect(() => {
    const q = query(collectionGroup(db, 'inscripciones'), where('userId', '==', userId))
    return onSnapshot(
      q,
      (snap) => {
        setCursoIds(
          snap.docs
            .map((d) => d.ref.parent.parent?.id)
            .filter((id): id is string => !!id),
        )
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [userId])

  useEffect(() => {
    const q = query(collection(db, 'horarios'), where('userId', '==', userId))
    return onSnapshot(q, (snap) => {
      const map: Record<string, Horario> = {}
      snap.docs.forEach((d) => {
        const data = d.data()
        const cursoId = data.cursoId as string | undefined
        if (!cursoId) return
        map[cursoId] = {
          cursoId,
          modo: (data.modo as Modo) ?? 'semanal',
          dias: (data.dias as Dia[]) ?? [],
          fechas: (data.fechas as string[]) ?? [],
          hora: (data.hora as string | undefined) ?? null,
          vigenciaInicio: (data.vigenciaInicio as string | undefined) ?? null,
          vigenciaFin: (data.vigenciaFin as string | undefined) ?? null,
        }
      })
      setHorariosPorCurso(map)
    })
  }, [userId])

  const [ultimosReportes, setUltimosReportes] = useState<Avance[]>([])

  useEffect(() => {
    const q = query(
      collection(db, 'avances'),
      where('userId', '==', userId),
      orderBy('creadoEn', 'desc'),
      limit(3),
    )
    return onSnapshot(q, (snap) => {
      setUltimosReportes(
        snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            fecha: (data.fecha as string) ?? '',
            cursoId: (data.cursoId as string) ?? '',
            lecciones: (data.lecciones as number) ?? 0,
            aprendizaje: (data.aprendizaje as string) ?? '',
          }
        }),
      )
    })
  }, [userId])

  const cursosActuales = useMemo(() => {
    return cursoIds
      .map((cursoId) => {
        const curso = cursosPorId[cursoId]
        if (!curso) return null
        const horario = horariosPorCurso[cursoId]
        if (!horario || !horario.hora) {
          return { id: cursoId, nombre: curso.nombre, progreso: null as number | null, estado: 'Sin horario asignado' }
        }
        const completadas = ocurrenciasEntre(horario, '0001-01-01', todayIso()).length
        const total = curso.duracionValor > 0 ? curso.duracionValor : 1
        const progreso = Math.min(100, Math.round((completadas / total) * 100))
        const estado =
          completadas === 0 ? 'Asignado · Aún sin sesiones' : progreso >= 100 ? 'Completado' : 'En progreso'
        return { id: cursoId, nombre: curso.nombre, progreso, estado }
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
  }, [cursoIds, cursosPorId, horariosPorCurso])

  const proximasSesiones = useMemo(() => {
    const hoy = todayIso()
    const ventana = addDays(hoy, 180)
    const ahora = new Date()
    const horaActual = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`

    const candidatas = cursoIds.flatMap((cursoId) => {
      const curso = cursosPorId[cursoId]
      const horario = horariosPorCurso[cursoId]
      if (!curso || !horario || !horario.hora) return []
      return ocurrenciasEntre(horario, hoy, ventana).map((fecha) => ({
        cursoId,
        nombre: curso.nombre,
        fecha,
        hora: horario.hora as string,
      }))
    })

    return candidatas
      .filter((s) => s.fecha > hoy || s.hora >= horaActual)
      .sort((a, b) => (a.fecha === b.fecha ? a.hora.localeCompare(b.hora) : a.fecha.localeCompare(b.fecha)))
      .slice(0, 3)
  }, [cursoIds, cursosPorId, horariosPorCurso])

  const proximaSesion = proximasSesiones[0] ?? null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Hola, {primerNombre}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{formatFechaSesion(todayIso())}</p>
        </div>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-400 p-6 text-white shadow-sm dark:from-indigo-500 dark:to-indigo-400">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium tracking-wide text-blue-100 uppercase dark:text-indigo-100">
              Tu próxima sesión
            </p>
            {proximaSesion ? (
              <>
                <h2 className="mt-1 text-xl font-bold">{proximaSesion.nombre}</h2>
                <p className="mt-1 text-sm text-blue-50 dark:text-indigo-50">
                  {formatFechaSesion(proximaSesion.fecha)} · {formatHora(proximaSesion.hora)}
                </p>
              </>
            ) : (
              <h2 className="mt-1 text-xl font-bold">No tenés sesiones programadas</h2>
            )}
          </div>
          <button
            type="button"
            onClick={onRegistrarAvance}
            className="w-fit rounded-lg bg-white px-4 py-2 text-sm font-semibold text-blue-600 shadow-sm hover:bg-blue-50 dark:text-indigo-600 dark:hover:bg-indigo-50"
          >
            Registrar avance →
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="mb-4 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
            Cursos actuales
          </p>
          {loading ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">Cargando...</p>
          ) : cursosActuales.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">No tenés cursos asignados todavía.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {cursosActuales.map((c) => (
                <div key={c.id}>
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{c.nombre}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{c.estado}</p>
                    </div>
                    {c.progreso !== null && (
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {c.progreso}%
                      </span>
                    )}
                  </div>
                  {c.progreso !== null && (
                    <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800">
                      <div
                        className="h-1.5 rounded-full bg-blue-500 dark:bg-indigo-500"
                        style={{ width: `${c.progreso}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="mb-4 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
            Próximas sesiones
          </p>
          {loading ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">Cargando...</p>
          ) : proximasSesiones.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">No tenés sesiones programadas.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
              {proximasSesiones.map((s, i) => (
                <li key={i} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{s.nombre}</span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {formatFechaSesion(s.fecha)} · {formatHora(s.hora)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <p className="mb-4 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
          Últimos reportes
        </p>
        {ultimosReportes.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">Todavía no registraste ningún avance.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
                  <th className="pb-2 pr-4 font-semibold">Fecha</th>
                  <th className="pb-2 pr-4 font-semibold">Curso</th>
                  <th className="pb-2 pr-4 font-semibold">Lecciones</th>
                  <th className="pb-2 font-semibold">Aprendizaje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {ultimosReportes.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2.5 pr-4 whitespace-nowrap text-gray-500 dark:text-gray-400">
                      {formatFechaSesion(r.fecha)}
                    </td>
                    <td className="py-2.5 pr-4 font-medium text-gray-900 dark:text-gray-100">
                      {cursosPorId[r.cursoId]?.nombre ?? r.cursoId}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-500 dark:text-gray-400">{r.lecciones}</td>
                    <td className="py-2.5 text-gray-500 dark:text-gray-400">{r.aprendizaje}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

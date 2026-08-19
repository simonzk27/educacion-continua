import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Send } from 'lucide-react'
import { collection, collectionGroup, onSnapshot, type Timestamp } from 'firebase/firestore'
import { db } from './firebase'
import {
  type Dia,
  type Modo,
  diaCorto,
  diaIndex,
  finSemanaIso,
  formatHora,
  inicioSemanaIso,
  ocurrenciasEntre,
  todayIso,
} from './scheduleUtils'

type Usuario = {
  id: string
  nombre: string
  sede: string | null
  activo: boolean
}

type Curso = {
  id: string
  nombre: string
  duracionValor: number
}

type Inscripcion = {
  userId: string
  cursoId: string
}

type Horario = {
  userId: string
  cursoId: string
  modo: Modo
  dias: Dia[]
  fechas: string[]
  hora: string | null
  duracionMin: number | null
  vigenciaInicio: string | null
  vigenciaFin: string | null
}

type Avance = {
  userId: string
  cursoId: string
  fecha: string
  lecciones: number
  aprendizaje: string
  creadoEn: Timestamp | null
}

function horarioKey(cursoId: string, userId: string): string {
  return `${cursoId}_${userId}`
}

const sedes = ['Colombia', 'USA', 'CMC Entrenamiento']

function cumplimientoStyle(pct: number) {
  if (pct >= 100) return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
  if (pct > 0) return 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
  return 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'
}

function formatRangoSemana(inicio: string, fin: string): string {
  const [iy, im, id] = inicio.split('-').map(Number)
  const [fy, fm, fd] = fin.split('-').map(Number)
  const dIni = new Date(iy, im - 1, id).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })
  const dFin = new Date(fy, fm - 1, fd).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })
  return `Del ${dIni} al ${dFin} de ${fy}`
}

function horarioLabel(horario: Horario | undefined, inicio: string, fin: string): string {
  if (!horario || !horario.hora) return 'Sin programar'
  if (horario.modo === 'mensual') {
    const fechasSemana = horario.fechas.filter((f) => f >= inicio && f <= fin)
    if (fechasSemana.length === 0) return `${formatHora(horario.hora)}`
    const dias = fechasSemana.map((f) => {
      const [y, m, d] = f.split('-').map(Number)
      return new Date(y, m - 1, d).getDate()
    })
    return `${dias.join(', ')} · ${formatHora(horario.hora)}`
  }
  const dias = [...horario.dias].sort((a, b) => diaIndex[a] - diaIndex[b]).map((d) => diaCorto[d])
  return `${dias.join(', ')} ${formatHora(horario.hora)}`
}

function csvEscape(value: string | number): string {
  const str = String(value)
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

type FilaStaff = {
  colaboradorId: string
  colaborador: string
  cursoActual: string
  cursoASeguir: string | null
  horarios: string
  completaciones: number
  lecciones: number
  observaciones: string
}

type FilaCumplimiento = {
  colaboradorId: string
  colaborador: string
  sede: string
  programadas: number
  realizados: number
  sinReporte: number
}

export default function InformeSemanal() {
  const [semanaRef, setSemanaRef] = useState(todayIso())

  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [cursosPorId, setCursosPorId] = useState<Record<string, Curso>>({})
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([])
  const [horariosPorKey, setHorariosPorKey] = useState<Record<string, Horario>>({})
  const [avances, setAvances] = useState<Avance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onSnapshot(collection(db, 'users'), (snap) => {
      setUsuarios(
        snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            nombre: (data.nombre as string) ?? '',
            sede: (data.sede as string) ?? null,
            activo: data.activo !== false,
          }
        }),
      )
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'cursos'), (snap) => {
      const map: Record<string, Curso> = {}
      snap.docs.forEach((d) => {
        const data = d.data()
        map[d.id] = {
          id: d.id,
          nombre: (data.nombre as string) ?? d.id,
          duracionValor: (data.duracionValor as number) ?? 0,
        }
      })
      setCursosPorId(map)
    })
  }, [])

  useEffect(() => {
    return onSnapshot(collectionGroup(db, 'inscripciones'), (snap) => {
      setInscripciones(
        snap.docs
          .map((d) => {
            const userId = d.data().userId as string | undefined
            const cursoId = d.ref.parent.parent?.id
            return userId && cursoId ? { userId, cursoId } : null
          })
          .filter((v): v is Inscripcion => v !== null),
      )
    })
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'horarios'), (snap) => {
      const map: Record<string, Horario> = {}
      snap.docs.forEach((d) => {
        const data = d.data()
        const userId = data.userId as string | undefined
        const cursoId = data.cursoId as string | undefined
        if (!userId || !cursoId) return
        map[horarioKey(cursoId, userId)] = {
          userId,
          cursoId,
          modo: (data.modo as Modo) ?? 'semanal',
          dias: (data.dias as Dia[]) ?? [],
          fechas: (data.fechas as string[]) ?? [],
          hora: (data.hora as string | undefined) ?? null,
          duracionMin: (data.duracionMin as number | undefined) ?? null,
          vigenciaInicio: (data.vigenciaInicio as string | undefined) ?? null,
          vigenciaFin: (data.vigenciaFin as string | undefined) ?? null,
        }
      })
      setHorariosPorKey(map)
    })
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'avances'), (snap) => {
      setAvances(
        snap.docs.map((d) => {
          const data = d.data()
          return {
            userId: (data.userId as string) ?? '',
            cursoId: (data.cursoId as string) ?? '',
            fecha: (data.fecha as string) ?? '',
            lecciones: (data.lecciones as number) ?? 0,
            aprendizaje: (data.aprendizaje as string) ?? '',
            creadoEn: (data.creadoEn as Timestamp | undefined) ?? null,
          }
        }),
      )
    })
  }, [])

  const inicio = useMemo(() => inicioSemanaIso(semanaRef), [semanaRef])
  const fin = useMemo(() => finSemanaIso(semanaRef), [semanaRef])

  const inscripcionesPorUsuario = useMemo(() => {
    const map: Record<string, Inscripcion[]> = {}
    inscripciones.forEach((i) => {
      map[i.userId] = [...(map[i.userId] ?? []), i]
    })
    return map
  }, [inscripciones])

  const { grupos, cumplimiento } = useMemo(() => {
    const gruposMap: Record<string, FilaStaff[]> = {}
    const filasCumplimiento: FilaCumplimiento[] = []

    usuarios.forEach((user) => {
      const propias = inscripcionesPorUsuario[user.id] ?? []
      if (propias.length === 0) return

      const cursoInfos = propias
        .map((insc) => {
          const curso = cursosPorId[insc.cursoId]
          const horario = horariosPorKey[horarioKey(insc.cursoId, insc.userId)]
          if (!curso) return null

          const avancesSemana = avances
            .filter((a) => a.userId === insc.userId && a.cursoId === insc.cursoId && a.fecha >= inicio && a.fecha <= fin)
            .sort((a, b) => (b.creadoEn?.toMillis() ?? 0) - (a.creadoEn?.toMillis() ?? 0))

          const completadasTotal = horario ? ocurrenciasEntre(horario, '0001-01-01', todayIso()).length : 0
          const total = curso.duracionValor > 0 ? curso.duracionValor : 1
          const progreso = Math.min(100, Math.round((completadasTotal / total) * 100))

          return {
            cursoId: insc.cursoId,
            cursoNombre: curso.nombre,
            horario,
            progreso,
            completaciones: avancesSemana.length,
            lecciones: avancesSemana.reduce((s, a) => s + a.lecciones, 0),
            observacion: avancesSemana[0]?.aprendizaje ?? '',
            programadasSemana: horario ? ocurrenciasEntre(horario, inicio, fin).length : 0,
          }
        })
        .filter((c): c is NonNullable<typeof c> => c !== null)

      if (cursoInfos.length === 0) return

      const cursoActual =
        cursoInfos.find((c) => c.progreso > 0 && c.progreso < 100) ??
        cursoInfos.find((c) => c.completaciones > 0) ??
        cursoInfos[0]
      const cursoASeguir = cursoInfos.find((c) => c.cursoId !== cursoActual.cursoId && c.progreso === 0) ?? null

      const sedeKey = user.sede ?? 'Sin sede'
      gruposMap[sedeKey] = [
        ...(gruposMap[sedeKey] ?? []),
        {
          colaboradorId: user.id,
          colaborador: user.nombre,
          cursoActual: cursoActual.cursoNombre,
          cursoASeguir: cursoASeguir?.cursoNombre ?? null,
          horarios: horarioLabel(cursoActual.horario, inicio, fin),
          completaciones: cursoActual.completaciones,
          lecciones: cursoActual.lecciones,
          observaciones: cursoActual.observacion || '—',
        },
      ]

      const programadas = cursoInfos.reduce((s, c) => s + c.programadasSemana, 0)
      const realizados = cursoInfos.reduce((s, c) => s + c.completaciones, 0)
      if (programadas > 0) {
        filasCumplimiento.push({
          colaboradorId: user.id,
          colaborador: user.nombre,
          sede: user.sede ?? '—',
          programadas,
          realizados,
          sinReporte: Math.max(0, programadas - realizados),
        })
      }
    })

    const gruposOrdenados = [...sedes, ...Object.keys(gruposMap).filter((s) => !sedes.includes(s))]
      .filter((s) => gruposMap[s]?.length)
      .map((s) => ({ titulo: s, filas: gruposMap[s] }))

    return { grupos: gruposOrdenados, cumplimiento: filasCumplimiento }
  }, [usuarios, inscripcionesPorUsuario, cursosPorId, horariosPorKey, avances, inicio, fin])

  const totalCompletaciones = grupos.reduce((sum, g) => sum + g.filas.reduce((s, f) => s + f.completaciones, 0), 0)
  const totalLecciones = grupos.reduce((sum, g) => sum + g.filas.reduce((s, f) => s + f.lecciones, 0), 0)

  function exportarCsv() {
    const filas = grupos.flatMap((g) =>
      g.filas.map((f) => [
        g.titulo,
        f.colaborador,
        f.cursoActual,
        f.cursoASeguir ?? '',
        f.horarios,
        f.completaciones,
        f.lecciones,
        f.observaciones,
      ]),
    )
    const encabezado = [
      'Sede',
      'Colaborador',
      'Curso actual',
      'Curso a seguir',
      'Horarios',
      'Completaciones',
      'Lecciones',
      'Observaciones',
    ]
    const csv = [encabezado, ...filas].map((fila) => fila.map(csvEscape).join(',')).join('\n')
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `informe-semanal_${inicio}_${fin}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Informe semanal</h1>
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              title="Semana anterior"
              onClick={() => setSemanaRef((s) => addWeeks(s, -1))}
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-800 dark:hover:text-indigo-400"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm text-gray-500 dark:text-gray-400">{formatRangoSemana(inicio, fin)}</p>
            <button
              type="button"
              title="Semana siguiente"
              onClick={() => setSemanaRef((s) => addWeeks(s, 1))}
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-800 dark:hover:text-indigo-400"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {inicio !== inicioSemanaIso(todayIso()) && (
              <button
                type="button"
                onClick={() => setSemanaRef(todayIso())}
                className="text-xs font-medium text-blue-600 hover:underline dark:text-indigo-400"
              >
                Ir a hoy
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportarCsv}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <Download className="h-4 w-4" />
            Excel (CSV)
          </button>
          <button
            type="button"
            disabled
            title="Próximamente"
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-400 opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-500"
          >
            <Download className="h-4 w-4" />
            PDF
          </button>
          <button
            type="button"
            disabled
            title="Próximamente"
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white opacity-60 shadow-sm dark:bg-indigo-500"
          >
            <Send className="h-4 w-4" />
            Enviar a gerencia
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:max-w-md">
        <div className="rounded-2xl bg-emerald-50 p-5 dark:bg-emerald-500/10">
          <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">{totalCompletaciones}</p>
          <p className="text-sm text-emerald-700/80 dark:text-emerald-400/80">Total completaciones</p>
        </div>
        <div className="rounded-2xl bg-emerald-50 p-5 dark:bg-emerald-500/10">
          <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">{totalLecciones}</p>
          <p className="text-sm text-emerald-700/80 dark:text-emerald-400/80">Total lecciones / pasos</p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">Cargando...</p>
      ) : grupos.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">
          No hay colaboradores con cursos asignados todavía.
        </p>
      ) : (
        grupos.map((g) => (
          <div key={g.titulo} className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <p className="px-5 pt-4 text-sm font-bold tracking-wide text-blue-600 uppercase dark:text-indigo-400">
              {g.titulo}
            </p>
            <div className="overflow-x-auto">
              <table className="mt-2 w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-y border-gray-100 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:border-gray-800 dark:text-gray-500">
                    <th className="px-5 py-2.5 font-semibold">Colaborador</th>
                    <th className="px-5 py-2.5 font-semibold">Curso actual</th>
                    <th className="px-5 py-2.5 font-semibold">Curso a seguir</th>
                    <th className="px-5 py-2.5 font-semibold">Horarios</th>
                    <th className="px-5 py-2.5 font-semibold">Completaciones</th>
                    <th className="px-5 py-2.5 font-semibold">Lecciones</th>
                    <th className="px-5 py-2.5 font-semibold">Observaciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {g.filas.map((f) => (
                    <tr key={f.colaboradorId}>
                      <td className="px-5 py-3 font-semibold text-gray-900 dark:text-gray-100">
                        {f.colaborador}
                      </td>
                      <td className="px-5 py-3 text-blue-600 dark:text-indigo-400">{f.cursoActual}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{f.cursoASeguir ?? '—'}</td>
                      <td className="px-5 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">
                        {f.horarios}
                      </td>
                      <td className="px-5 py-3 font-medium text-blue-600 dark:text-indigo-400">
                        {f.completaciones}
                      </td>
                      <td className="px-5 py-3 text-gray-900 dark:text-gray-100">{f.lecciones}</td>
                      <td className="px-5 py-3 text-gray-400 italic dark:text-gray-500">{f.observaciones}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-bold text-gray-900 dark:bg-gray-800/60 dark:text-gray-100">
                    <td className="px-5 py-3" colSpan={4}>
                      Total
                    </td>
                    <td className="px-5 py-3">{g.filas.reduce((s, f) => s + f.completaciones, 0)}</td>
                    <td className="px-5 py-3">{g.filas.reduce((s, f) => s + f.lecciones, 0)}</td>
                    <td className="px-5 py-3" />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <p className="px-5 pt-4 text-sm font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">
          Cumplimiento gerencial
        </p>
        {!loading && cumplimiento.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400 dark:text-gray-500">
            Nadie tenía sesiones programadas esta semana.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="mt-2 w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-y border-gray-100 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:border-gray-800 dark:text-gray-500">
                  <th className="px-5 py-2.5 font-semibold">Colaborador</th>
                  <th className="px-5 py-2.5 font-semibold">Sede</th>
                  <th className="px-5 py-2.5 font-semibold">Sesiones programadas</th>
                  <th className="px-5 py-2.5 font-semibold">Reportes realizados</th>
                  <th className="px-5 py-2.5 font-semibold">Sin reporte</th>
                  <th className="px-5 py-2.5 font-semibold">% Cumplimiento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {cumplimiento.map((f) => {
                  const pct = Math.round((f.realizados / f.programadas) * 100)
                  return (
                    <tr key={f.colaboradorId}>
                      <td className="px-5 py-3 font-semibold text-gray-900 dark:text-gray-100">
                        {f.colaborador}
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{f.sede}</td>
                      <td className="px-5 py-3 text-gray-900 dark:text-gray-100">{f.programadas}</td>
                      <td className="px-5 py-3 font-medium text-blue-600 dark:text-indigo-400">
                        {f.realizados}
                      </td>
                      <td className="px-5 py-3 text-gray-900 dark:text-gray-100">{f.sinReporte}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cumplimientoStyle(pct)}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {pct}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="h-4" />
      </div>
    </div>
  )
}

function addWeeks(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + delta * 7)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

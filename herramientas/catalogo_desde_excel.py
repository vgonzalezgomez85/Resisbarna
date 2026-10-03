#!/usr/bin/env python3
"""
Genera assets/data/catalogo.json (página "Prepara tu coche") a partir del
Excel MAESTRO del catálogo, el mismo Google Sheet que usa PitWall Control.

Normalmente lo ejecuta solo el workflow .github/workflows/catalogo.yml, que
descarga el Sheet (compartido como "cualquiera con el enlace: lector") y hace
commit si algo ha cambiado.

Uso a mano:
  1. En el Google Sheet: Archivo → Descargar → Microsoft Excel (.xlsx).
  2. python3 herramientas/catalogo_desde_excel.py ~/Downloads/MAESTRO.xlsx
  3. Revisa los avisos (copas mal escritas, etc.), haz commit y push.

Necesita openpyxl (pip3 install openpyxl).
"""
import datetime
import json
import os
import re
import sys
import unicodedata

import openpyxl

SALIDA = os.path.join(os.path.dirname(__file__), '..', 'assets', 'data', 'catalogo.json')


def norm(s):
    s = unicodedata.normalize('NFD', str(s or '')).encode('ascii', 'ignore').decode()
    return re.sub(r'\s+', ' ', s).strip().upper()


def clave_copa(s):
    # "LMP2" y "LMP-2" son la misma copa: se compara sin espacios ni guiones.
    return re.sub(r'[^A-Z0-9]', '', norm(s))


def num(v):
    if v in (None, ''):
        return None
    if isinstance(v, (int, float)):
        return int(v) if float(v).is_integer() else round(float(v), 2)
    try:
        f = float(str(v).replace(',', '.'))
        return int(f) if f.is_integer() else f
    except ValueError:
        return None


def txt(v):
    if v is None:
        return ''
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return re.sub(r'\s+', ' ', str(v)).strip()


def copas(v):
    return [c for c in (txt(x) for x in txt(v).split(',')) if c]


def filas(wb, pestana, columnas):
    """Devuelve dicts {campo: valor} para la pestaña, buscando la cabecera
    (primera fila con ≥2 celdas) y las columnas por su nombre."""
    ws = next((w for w in wb.worksheets if norm(w.title) == norm(pestana)), None)
    if ws is None:
        sys.exit(f'No encuentro la pestaña {pestana!r} en el Excel.')
    it = ws.iter_rows(values_only=True)
    for cab in it:
        if sum(1 for c in cab if txt(c)) >= 2:
            break
    idx = {norm(c): i for i, c in reversed(list(enumerate(cab))) if txt(c)}
    pos = {}
    for campo, nombres in columnas.items():
        pos[campo] = next((idx[norm(n)] for n in nombres if norm(n) in idx), None)
    for fila in it:
        d = {c: (fila[i] if i is not None and i < len(fila) else None) for c, i in pos.items()}
        yield d


def foto_drive(url):
    m = re.search(r'/d/([\w-]{10,})', txt(url)) or re.search(r'[?&]id=([\w-]{10,})', txt(url))
    return m.group(1) if m else None


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    wb = openpyxl.load_workbook(sys.argv[1], data_only=True, read_only=True)
    CAT = ['CATEGORÍA/COPA', 'COPA']

    copas_def = [txt(f['n']) for f in filas(wb, 'COPASCATEG.', {'n': CAT}) if txt(f['n'])]

    coches = []
    for f in filas(wb, 'COCHES', {'n': ['NOMBRE A MOSTRAR'], 'marca': ['MARCA'],
                                  'peso': ['PESO MINIMO'], 'cred': ['CREDITOS'],
                                  'copas': CAT, 'foto': ['FOTO']}):
        if not txt(f['n']):
            continue
        c = {'n': txt(f['n']), 'marca': txt(f['marca']), 'peso': num(f['peso']),
             'creditos': num(f['cred']), 'copas': copas(f['copas'])}
        if foto_drive(f['foto']):
            c['foto'] = foto_drive(f['foto'])
        coches.append(c)

    motores = [{'n': txt(f['n']), 'ref': txt(f['ref']), 'rpm': num(f['rpm']),
                'iman': num(f['iman']), 'copas': copas(f['copas'])}
               for f in filas(wb, 'MOTORES', {'n': ['MOTOR'], 'ref': ['REF'], 'rpm': ['RPM'],
                                              'iman': ['IMÁN'], 'copas': CAT})
               if txt(f['n'])]

    neumaticos = [{'n': txt(f['n']), 'ref': txt(f['ref']), 'copas': copas(f['copas'])}
                  for f in filas(wb, 'NEUMÁTICOS', {'n': ['NEUMATICO'], 'ref': ['REFERENCIA'],
                                                    'copas': CAT})
                  if txt(f['n'])]

    llantas = [{'n': txt(f['n']), 'tipo': txt(f['tipo']).upper(), 'copas': copas(f['copas'])}
               for f in filas(wb, 'LLANTAS', {'n': ['DIAMETRO LLANTAS'], 'tipo': ['TIPO'],
                                              'copas': CAT})
               if txt(f['n'])]

    engranajes = [{'tipo': norm(f['tipo']), 'dientes': num(f['dientes']),
                   'diametro': num(f['diam']), 'copas': copas(f['copas'])}
                  for f in filas(wb, 'ENGRANAJES', {'tipo': ['TIPO'], 'dientes': ['DIENTES'],
                                                    'diam': ['DIÁMETRO'], 'copas': CAT})
                  if txt(f['tipo']) and num(f['dientes']) is not None]

    bancadas = [{'n': txt(f['n']), 'ref': txt(f['ref']), 'specs': txt(f['specs']),
                 'copas': copas(f['copas'])}
                for f in filas(wb, 'BANCADAS', {'n': ['BANCADA'], 'ref': ['REFERENCIA'],
                                                'specs': ['SPECS BANCADA'], 'copas': CAT})
                if txt(f['n'])]

    datos = {
        'generado': datetime.date.today().isoformat(),
        'copas': copas_def,
        'coches': coches, 'motores': motores, 'neumaticos': neumaticos,
        'llantas': llantas, 'engranajes': engranajes, 'bancadas': bancadas,
    }

    # Avisos: copas usadas en el material que no existen en COPAS/CATEG.
    conocidas = {clave_copa(c) for c in copas_def}
    raras = {}
    for tipo in ('coches', 'motores', 'neumaticos', 'llantas', 'engranajes', 'bancadas'):
        for x in datos[tipo]:
            for c in x['copas']:
                if clave_copa(c) not in conocidas:
                    raras.setdefault(c, set()).add(tipo)
    for c, tipos in sorted(raras.items()):
        print(f'AVISO: copa {c!r} (en {", ".join(sorted(tipos))}) no está en la pestaña COPAS/CATEG.')

    # Si los datos no han cambiado se conserva la fecha anterior, para no
    # generar un commit cada vez que se ejecuta el workflow.
    try:
        with open(SALIDA, encoding='utf-8') as fh:
            anterior = json.load(fh)
        if {**anterior, 'generado': None} == {**datos, 'generado': None}:
            datos['generado'] = anterior['generado']
    except (OSError, ValueError, KeyError):
        pass

    with open(SALIDA, 'w', encoding='utf-8') as fh:
        json.dump(datos, fh, ensure_ascii=False, separators=(',', ':'))
        fh.write('\n')
    print(f'OK: {len(coches)} coches, {len(motores)} motores, {len(neumaticos)} neumáticos, '
          f'{len(llantas)} llantas, {len(engranajes)} engranajes, {len(bancadas)} bancadas → '
          f'{os.path.relpath(SALIDA)}')


if __name__ == '__main__':
    main()

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, Color
import itertools
import math

# --- Card data ---
base_vectors = [(1,0), (0,1), (1,1), (2,1), (1,2)]
vector_cards = set()
for (a, b) in base_vectors:
    for sa, sb in itertools.product([1, -1], repeat=2):
        vec = (sa * a, sb * b)
        if vec != (0, 0):
            vector_cards.add(vec)
vector_cards = sorted(vector_cards, key=lambda v: (abs(v[0]) + abs(v[1]), v[0], v[1]))

scalar_values = [-3, -2, -1, 1, 2, 3]

# --- PDF settings ---
PAGE_W, PAGE_H = letter

CARD_W = 2.2 * inch
CARD_H = 3.0 * inch

MARGIN_X = 0.45 * inch
MARGIN_TOP = 0.4 * inch
COLS = 3
ROWS = 3
GAP_X = (PAGE_W - 2 * MARGIN_X - COLS * CARD_W) / max(COLS - 1, 1)
GAP_Y = 0.25 * inch

# Colors - Brown for vectors
VEC_DARK = HexColor("#5D4037")
VEC_MED = HexColor("#795548")
VEC_LIGHT = HexColor("#D7CCC8")
VEC_BG = HexColor("#EFEBE9")
VEC_ACCENT = HexColor("#8D6E63")
VEC_HIGHLIGHT = HexColor("#A1887F")

# Colors - Forest green for scalars
SCA_DARK = HexColor("#4A6B4A")
SCA_MED = HexColor("#719972")
SCA_LIGHT = HexColor("#C5D9C5")
SCA_BG = HexColor("#E8F0E8")
SCA_ACCENT = HexColor("#8AB08A")
SCA_HIGHLIGHT = HexColor("#9DC09D")

# Back colors
VEC_BACK_BG = HexColor("#4E342E")
SCA_BACK_BG = HexColor("#3A5C3A")

LABEL_COLOR = HexColor("#888888")
WHITE = HexColor("#FFFFFF")

cards_per_page = COLS * ROWS

def card_position(idx):
    col = idx % COLS
    row = idx // COLS
    x = MARGIN_X + col * (CARD_W + GAP_X)
    y = PAGE_H - MARGIN_TOP - (row + 1) * CARD_H - row * GAP_Y
    return x, y

def card_position_mirrored(idx):
    """Mirror horizontally for back side (flip along vertical axis for double-sided printing)."""
    col = idx % COLS
    row = idx // COLS
    # Mirror: col 0->2, 1->1, 2->0
    mirrored_col = (COLS - 1) - col
    x = MARGIN_X + mirrored_col * (CARD_W + GAP_X)
    y = PAGE_H - MARGIN_TOP - (row + 1) * CARD_H - row * GAP_Y
    return x, y

def draw_rounded_rect(c, x, y, w, h, r, fill_color, stroke_color, line_width=1.5):
    p = c.beginPath()
    p.roundRect(x, y, w, h, r)
    c.setFillColor(fill_color)
    c.setStrokeColor(stroke_color)
    c.setLineWidth(line_width)
    c.drawPath(p, fill=1, stroke=1)

def draw_cut_marks(c, x, y, w, h):
    """Draw corner cut marks instead of full dashed border."""
    c.saveState()
    c.setStrokeColor(HexColor("#BBBBBB"))
    c.setLineWidth(0.4)
    mark_len = 8
    offset = 4
    corners = [
        (x - offset, y - offset),
        (x + w + offset, y - offset),
        (x - offset, y + h + offset),
        (x + w + offset, y + h + offset),
    ]
    # Bottom-left
    c.line(x - offset, y - offset, x - offset + mark_len, y - offset)
    c.line(x - offset, y - offset, x - offset, y - offset + mark_len)
    # Bottom-right
    c.line(x + w + offset, y - offset, x + w + offset - mark_len, y - offset)
    c.line(x + w + offset, y - offset, x + w + offset, y - offset + mark_len)
    # Top-left
    c.line(x - offset, y + h + offset, x - offset + mark_len, y + h + offset)
    c.line(x - offset, y + h + offset, x - offset, y + h + offset - mark_len)
    # Top-right
    c.line(x + w + offset, y + h + offset, x + w + offset - mark_len, y + h + offset)
    c.line(x + w + offset, y + h + offset, x + w + offset, y + h + offset - mark_len)
    c.restoreState()

def draw_decorative_border(c, x, y, w, h, color, inner_offset=5):
    """Draw a thin inner decorative border."""
    c.saveState()
    c.setStrokeColor(color)
    c.setLineWidth(0.5)
    p = c.beginPath()
    o = inner_offset
    r = 7
    p.roundRect(x + o, y + o, w - 2*o, h - 2*o, r)
    c.drawPath(p, fill=0, stroke=1)
    c.restoreState()

def draw_corner_ornaments(c, x, y, w, h, color):
    """Draw small decorative diamond shapes in corners."""
    c.saveState()
    c.setFillColor(color)
    size = 4
    positions = [
        (x + 12, y + 12),
        (x + w - 12, y + 12),
        (x + 12, y + h - 12),
        (x + w - 12, y + h - 12),
    ]
    for px, py in positions:
        p = c.beginPath()
        p.moveTo(px, py + size)
        p.lineTo(px + size, py)
        p.lineTo(px, py - size)
        p.lineTo(px - size, py)
        p.close()
        c.drawPath(p, fill=1, stroke=0)
    c.restoreState()

def draw_grid_arrow(c, cx, cy, vx, vy, color):
    """Draw a small vector arrow visualization on the card."""
    c.saveState()
    grid_size = 10
    # Draw faint grid dots
    c.setFillColor(HexColor("#00000022"))
    for gx in range(-2, 3):
        for gy in range(-2, 3):
            c.circle(cx + gx * grid_size, cy + gy * grid_size, 1, fill=1, stroke=0)

    # Draw arrow
    end_x = cx + vx * grid_size
    end_y = cy + vy * grid_size
    c.setStrokeColor(color)
    c.setLineWidth(2)
    c.line(cx, cy, end_x, end_y)

    # Arrowhead
    angle = math.atan2(vy * grid_size, vx * grid_size)
    arrow_len = 5
    c.setFillColor(color)
    p = c.beginPath()
    p.moveTo(end_x, end_y)
    p.lineTo(end_x - arrow_len * math.cos(angle - 0.4), end_y - arrow_len * math.sin(angle - 0.4))
    p.lineTo(end_x - arrow_len * math.cos(angle + 0.4), end_y - arrow_len * math.sin(angle + 0.4))
    p.close()
    c.drawPath(p, fill=1, stroke=0)

    # Origin dot
    c.setFillColor(color)
    c.circle(cx, cy, 2.5, fill=1, stroke=0)
    c.restoreState()

def draw_vector_card_front(c, x, y, vec):
    draw_cut_marks(c, x, y, CARD_W, CARD_H)

    # Main card body
    draw_rounded_rect(c, x, y, CARD_W, CARD_H, 10, VEC_BG, VEC_DARK, 2)

    # Inner decorative border
    draw_decorative_border(c, x, y, CARD_W, CARD_H, VEC_LIGHT)

    # Corner ornaments
    draw_corner_ornaments(c, x, y, CARD_W, CARD_H, VEC_ACCENT)

    # Top banner
    banner_h = 22
    c.saveState()
    p = c.beginPath()
    p.roundRect(x + 8, y + CARD_H - 8 - banner_h, CARD_W - 16, banner_h, 4)
    c.setFillColor(VEC_DARK)
    c.drawPath(p, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(x + CARD_W / 2, y + CARD_H - 8 - banner_h + 7, "VECTOR")
    c.restoreState()

    cx = x + CARD_W / 2
    cy = y + CARD_H / 2 + 12

    # Draw bracket
    c.setStrokeColor(VEC_DARK)
    c.setLineWidth(2.5)
    bracket_h = 48
    bracket_w = 8
    bx = cx - 32
    c.line(bx + bracket_w, cy + bracket_h/2, bx, cy + bracket_h/2)
    c.line(bx, cy + bracket_h/2, bx, cy - bracket_h/2)
    c.line(bx, cy - bracket_h/2, bx + bracket_w, cy - bracket_h/2)
    bx2 = cx + 32
    c.line(bx2 - bracket_w, cy + bracket_h/2, bx2, cy + bracket_h/2)
    c.line(bx2, cy + bracket_h/2, bx2, cy - bracket_h/2)
    c.line(bx2, cy - bracket_h/2, bx2 - bracket_w, cy - bracket_h/2)

    # Vector components
    c.setFillColor(VEC_DARK)
    c.setFont("Helvetica-Bold", 30)
    def fmt(n):
        if n < 0:
            return f"\u2212{abs(n)}"
        return str(n)
    c.drawCentredString(cx, cy + 8, fmt(vec[0]))
    c.drawCentredString(cx, cy - 22, fmt(vec[1]))


def draw_scalar_card_front(c, x, y, val):
    draw_cut_marks(c, x, y, CARD_W, CARD_H)

    # Main card body
    draw_rounded_rect(c, x, y, CARD_W, CARD_H, 10, SCA_BG, SCA_DARK, 2)

    # Inner decorative border
    draw_decorative_border(c, x, y, CARD_W, CARD_H, SCA_LIGHT)

    # Corner ornaments
    draw_corner_ornaments(c, x, y, CARD_W, CARD_H, SCA_ACCENT)

    # Top banner
    banner_h = 22
    c.saveState()
    p = c.beginPath()
    p.roundRect(x + 8, y + CARD_H - 8 - banner_h, CARD_W - 16, banner_h, 4)
    c.setFillColor(SCA_DARK)
    c.drawPath(p, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(x + CARD_W / 2, y + CARD_H - 8 - banner_h + 7, "SCALAR")
    c.restoreState()

    cx = x + CARD_W / 2
    cy = y + CARD_H / 2 + 5

    # Large scalar display
    c.setFillColor(SCA_DARK)
    if val < 0:
        display = f"\u2212{abs(val)}"
        c.setFont("Helvetica-Bold", 52)
    else:
        display = str(val)
        c.setFont("Helvetica-Bold", 52)
    c.drawCentredString(cx, cy - 15, display)


def draw_vector_card_back(c, x, y):
    """Draw the back of a vector card."""
    draw_cut_marks(c, x, y, CARD_W, CARD_H)
    draw_rounded_rect(c, x, y, CARD_W, CARD_H, 10, VEC_BACK_BG, VEC_DARK, 2)
    draw_decorative_border(c, x, y, CARD_W, CARD_H, VEC_ACCENT)
    draw_corner_ornaments(c, x, y, CARD_W, CARD_H, VEC_HIGHLIGHT)

    cx = x + CARD_W / 2
    cy = y + CARD_H / 2

    # Decorative pattern - grid of small arrows
    c.saveState()
    arrow_color = Color(1, 1, 1, 0.15)
    c.setStrokeColor(arrow_color)
    c.setFillColor(arrow_color)
    spacing = 22
    for gx in range(-2, 3):
        for gy in range(-3, 4):
            ax = cx + gx * spacing
            ay = cy + gy * spacing
            # Small arrow pointing up-right
            c.setLineWidth(1)
            c.line(ax - 4, ay - 4, ax + 4, ay + 4)
            p = c.beginPath()
            p.moveTo(ax + 4, ay + 4)
            p.lineTo(ax + 1, ay + 4)
            p.lineTo(ax + 4, ay + 1)
            p.close()
            c.drawPath(p, fill=1, stroke=0)
    c.restoreState()

    # Center title
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(cx, cy + 20, "VECTOR")
    c.drawCentredString(cx, cy - 2, "CHESS")

    # Decorative line
    c.setStrokeColor(VEC_HIGHLIGHT)
    c.setLineWidth(1)
    c.line(cx - 35, cy + 15, cx + 35, cy + 15)
    c.line(cx - 35, cy - 5, cx + 35, cy - 5)

    # Small V icon
    c.setFillColor(VEC_HIGHLIGHT)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(cx, cy - 22, "\u2666  VECTOR  \u2666")

def draw_scalar_card_back(c, x, y):
    """Draw the back of a scalar card."""
    draw_cut_marks(c, x, y, CARD_W, CARD_H)
    draw_rounded_rect(c, x, y, CARD_W, CARD_H, 10, SCA_BACK_BG, SCA_DARK, 2)
    draw_decorative_border(c, x, y, CARD_W, CARD_H, SCA_ACCENT)
    draw_corner_ornaments(c, x, y, CARD_W, CARD_H, SCA_HIGHLIGHT)

    cx = x + CARD_W / 2
    cy = y + CARD_H / 2

    # Decorative pattern - multiply symbols
    c.saveState()
    sym_color = Color(1, 1, 1, 0.12)
    c.setFillColor(sym_color)
    c.setFont("Helvetica-Bold", 18)
    spacing = 28
    for gx in range(-2, 3):
        for gy in range(-3, 4):
            sx = cx + gx * spacing + (10 if gy % 2 else 0)
            sy = cy + gy * spacing
            c.drawCentredString(sx, sy, "\u00d7")
    c.restoreState()

    # Center title
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(cx, cy + 20, "VECTOR")
    c.drawCentredString(cx, cy - 2, "CHESS")

    c.setStrokeColor(SCA_HIGHLIGHT)
    c.setLineWidth(1)
    c.line(cx - 35, cy + 15, cx + 35, cy + 15)
    c.line(cx - 35, cy - 5, cx + 35, cy - 5)

    c.setFillColor(SCA_HIGHLIGHT)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(cx, cy - 22, "\u2666  SCALAR  \u2666")

def add_page_footer(c):
    pass  # No footer text

def add_page_header(c, title, page_num, total_pages):
    c.setFillColor(HexColor("#333333"))
    c.setFont("Helvetica-Bold", 11)
    c.drawString(MARGIN_X, PAGE_H - 25, f"Vector Chess \u2014 {title}")
    c.setFont("Helvetica", 9)
    c.setFillColor(LABEL_COLOR)
    c.drawRightString(PAGE_W - MARGIN_X, PAGE_H - 25, f"Page {page_num}/{total_pages}")
    add_page_footer(c)

# --- Token settings ---
TOKEN_COUNT = 50
TOKEN_SIZE = 0.75 * inch  # diameter
TOKEN_MARGIN_X = 0.4 * inch
TOKEN_MARGIN_TOP = 0.45 * inch
TOKEN_COLS = 10
TOKEN_ROWS = 10
TOKEN_GAP_X = (PAGE_W - 2 * TOKEN_MARGIN_X - TOKEN_COLS * TOKEN_SIZE) / max(TOKEN_COLS - 1, 1)
TOKEN_GAP_Y = (PAGE_H - TOKEN_MARGIN_TOP - 0.4 * inch - TOKEN_ROWS * TOKEN_SIZE) / max(TOKEN_ROWS - 1, 1)
# Cap gaps so they don't get huge
TOKEN_GAP_X = min(TOKEN_GAP_X, 0.15 * inch)
TOKEN_GAP_Y = min(TOKEN_GAP_Y, 0.15 * inch)

RED_TOKEN = HexColor("#D32F2F")
RED_TOKEN_LIGHT = HexColor("#FFCDD2")
RED_TOKEN_BORDER = HexColor("#B71C1C")
PINK_TOKEN = HexColor("#E91E90")
PINK_TOKEN_LIGHT = HexColor("#FCE4EC")
PINK_TOKEN_BORDER = HexColor("#AD1457")

tokens_per_page = TOKEN_COLS * TOKEN_ROWS  # 100, but we only need 50 each

def token_position(idx):
    col = idx % TOKEN_COLS
    row = idx // TOKEN_COLS
    x = TOKEN_MARGIN_X + col * (TOKEN_SIZE + TOKEN_GAP_X) + TOKEN_SIZE / 2
    y = PAGE_H - TOKEN_MARGIN_TOP - row * (TOKEN_SIZE + TOKEN_GAP_Y) - TOKEN_SIZE / 2
    return x, y

def draw_red_x_token(c, cx, cy):
    """Draw a circular red X token."""
    r = TOKEN_SIZE / 2
    # Outer circle
    c.setFillColor(RED_TOKEN_LIGHT)
    c.setStrokeColor(RED_TOKEN_BORDER)
    c.setLineWidth(1.5)
    c.circle(cx, cy, r, fill=1, stroke=1)
    # Inner circle accent
    c.setStrokeColor(RED_TOKEN)
    c.setLineWidth(0.5)
    c.circle(cx, cy, r - 3, fill=0, stroke=1)
    # Draw X
    c.setStrokeColor(RED_TOKEN)
    c.setLineWidth(3)
    xlen = r * 0.45
    c.line(cx - xlen, cy - xlen, cx + xlen, cy + xlen)
    c.line(cx - xlen, cy + xlen, cx + xlen, cy - xlen)

def draw_pink_star_token(c, cx, cy):
    """Draw a circular pink star (✦) token."""
    r = TOKEN_SIZE / 2
    # Outer circle
    c.setFillColor(PINK_TOKEN_LIGHT)
    c.setStrokeColor(PINK_TOKEN_BORDER)
    c.setLineWidth(1.5)
    c.circle(cx, cy, r, fill=1, stroke=1)
    # Inner circle accent
    c.setStrokeColor(PINK_TOKEN)
    c.setLineWidth(0.5)
    c.circle(cx, cy, r - 3, fill=0, stroke=1)
    # Draw 4-pointed star
    c.setFillColor(PINK_TOKEN)
    star_r = r * 0.55
    star_inner = r * 0.18
    p = c.beginPath()
    points = 4
    for i in range(points * 2):
        angle = math.pi / 2 + i * math.pi / points
        radius = star_r if i % 2 == 0 else star_inner
        px = cx + radius * math.cos(angle)
        py = cy + radius * math.sin(angle)
        if i == 0:
            p.moveTo(px, py)
        else:
            p.lineTo(px, py)
    p.close()
    c.drawPath(p, fill=1, stroke=0)

def add_token_page_header(c, title, page_num, total_pages):
    c.setFillColor(HexColor("#333333"))
    c.setFont("Helvetica-Bold", 11)
    c.drawString(TOKEN_MARGIN_X, PAGE_H - 25, f"Vector Chess \u2014 {title}")
    c.setFont("Helvetica", 9)
    c.setFillColor(LABEL_COLOR)
    c.drawRightString(PAGE_W - TOKEN_MARGIN_X, PAGE_H - 25, f"Page {page_num}/{total_pages}")

# --- Build separate PDFs ---
import os
out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
os.makedirs(out_dir, exist_ok=True)

num_vector_pages = (len(vector_cards) + cards_per_page - 1) // cards_per_page
num_scalar_pages = (len(scalar_values) + cards_per_page - 1) // cards_per_page
num_red_token_pages = (TOKEN_COUNT + tokens_per_page - 1) // tokens_per_page
num_pink_token_pages = (TOKEN_COUNT + tokens_per_page - 1) // tokens_per_page

# ========== 1. Vector Cards PDF ==========
vec_total = num_vector_pages * 2
c = canvas.Canvas(f"{out_dir}/vector_cards.pdf", pagesize=letter)
c.setTitle("Vector Chess — Vector Cards")
c.setAuthor("Vector Chess")
page_num = 0

for page_i in range(num_vector_pages):
    start = page_i * cards_per_page
    end = min(start + cards_per_page, len(vector_cards))
    count_on_page = end - start

    if page_num > 0:
        c.showPage()
    page_num += 1
    add_page_header(c, "Vector Cards (Front)", page_num, vec_total)
    for i in range(count_on_page):
        x, y = card_position(i)
        draw_vector_card_front(c, x, y, vector_cards[start + i])

    c.showPage()
    page_num += 1
    add_page_header(c, "Vector Cards (Back)", page_num, vec_total)
    for i in range(count_on_page):
        x, y = card_position_mirrored(i)
        draw_vector_card_back(c, x, y)

c.save()
print(f"Created: vector_cards.pdf ({vec_total} pages, {len(vector_cards)} cards)")

# ========== 2. Scalar Cards PDF ==========
sca_total = num_scalar_pages * 2
c = canvas.Canvas(f"{out_dir}/scalar_cards.pdf", pagesize=letter)
c.setTitle("Vector Chess — Scalar Cards")
c.setAuthor("Vector Chess")
page_num = 0

for page_i in range(num_scalar_pages):
    start = page_i * cards_per_page
    end = min(start + cards_per_page, len(scalar_values))
    count_on_page = end - start

    if page_num > 0:
        c.showPage()
    page_num += 1
    add_page_header(c, "Scalar Cards (Front)", page_num, sca_total)
    for i in range(count_on_page):
        x, y = card_position(i)
        draw_scalar_card_front(c, x, y, scalar_values[start + i])

    c.showPage()
    page_num += 1
    add_page_header(c, "Scalar Cards (Back)", page_num, sca_total)
    for i in range(count_on_page):
        x, y = card_position_mirrored(i)
        draw_scalar_card_back(c, x, y)

c.save()
print(f"Created: scalar_cards.pdf ({sca_total} pages, {len(scalar_values)} cards)")

# ========== 3. Red X Tokens PDF ==========
c = canvas.Canvas(f"{out_dir}/red_x_tokens.pdf", pagesize=letter)
c.setTitle("Vector Chess — Red X Tokens")
c.setAuthor("Vector Chess")
page_num = 0

for page_i in range(num_red_token_pages):
    start = page_i * tokens_per_page
    end = min(start + tokens_per_page, TOKEN_COUNT)
    count_on_page = end - start

    if page_num > 0:
        c.showPage()
    page_num += 1
    add_token_page_header(c, "Red X Tokens (Dead Squares)", page_num, num_red_token_pages)
    for i in range(count_on_page):
        cx, cy = token_position(i)
        draw_red_x_token(c, cx, cy)

c.save()
print(f"Created: red_x_tokens.pdf ({num_red_token_pages} pages, {TOKEN_COUNT} tokens)")

# ========== 4. Pink Star Tokens PDF ==========
c = canvas.Canvas(f"{out_dir}/pink_star_tokens.pdf", pagesize=letter)
c.setTitle("Vector Chess — Pink Star Tokens")
c.setAuthor("Vector Chess")
page_num = 0

for page_i in range(num_pink_token_pages):
    start = page_i * tokens_per_page
    end = min(start + tokens_per_page, TOKEN_COUNT)
    count_on_page = end - start

    if page_num > 0:
        c.showPage()
    page_num += 1
    add_token_page_header(c, "Pink Star Tokens (Special Squares)", page_num, num_pink_token_pages)
    for i in range(count_on_page):
        cx, cy = token_position(i)
        draw_pink_star_token(c, cx, cy)

c.save()
print(f"Created: pink_star_tokens.pdf ({num_pink_token_pages} pages, {TOKEN_COUNT} tokens)")

print("\nAll 4 PDFs created successfully!")
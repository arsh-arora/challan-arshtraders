/**
 * Convert a number to words in Indian currency format
 * e.g., 12345.67 -> "Twelve Thousand Three Hundred Forty Five Rupees and Sixty Seven Paise Only"
 */

const ones = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'
]

const tens = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
]

function convertLessThanHundred(num: number): string {
  if (num < 20) {
    return ones[num]
  }
  const ten = Math.floor(num / 10)
  const one = num % 10
  return tens[ten] + (one ? ' ' + ones[one] : '')
}

function convertLessThanThousand(num: number): string {
  if (num < 100) {
    return convertLessThanHundred(num)
  }
  const hundred = Math.floor(num / 100)
  const rest = num % 100
  return ones[hundred] + ' Hundred' + (rest ? ' ' + convertLessThanHundred(rest) : '')
}

/**
 * Convert number to words using Indian numbering system
 * (Lakhs and Crores instead of Millions and Billions)
 */
export function numberToWords(num: number): string {
  if (num === 0) return 'Zero'
  if (num < 0) return 'Minus ' + numberToWords(Math.abs(num))

  // Split into integer and decimal parts
  const intPart = Math.floor(num)
  const decPart = Math.round((num - intPart) * 100)

  let result = ''

  if (intPart === 0) {
    result = ''
  } else {
    // Indian numbering: Crore (10^7), Lakh (10^5), Thousand (10^3), Hundred (10^2)
    let n = intPart

    // Crores (10,000,000)
    if (n >= 10000000) {
      const crores = Math.floor(n / 10000000)
      result += convertLessThanThousand(crores) + ' Crore '
      n = n % 10000000
    }

    // Lakhs (100,000)
    if (n >= 100000) {
      const lakhs = Math.floor(n / 100000)
      result += convertLessThanHundred(lakhs) + ' Lakh '
      n = n % 100000
    }

    // Thousands (1,000)
    if (n >= 1000) {
      const thousands = Math.floor(n / 1000)
      result += convertLessThanHundred(thousands) + ' Thousand '
      n = n % 1000
    }

    // Hundreds and below
    if (n > 0) {
      result += convertLessThanThousand(n)
    }
  }

  // Build final string
  result = result.trim()

  if (result) {
    result += ' Rupees'
  }

  if (decPart > 0) {
    const paiseWords = convertLessThanHundred(decPart)
    result += (result ? ' and ' : '') + paiseWords + ' Paise'
  }

  return (result || 'Zero Rupees') + ' Only'
}

/**
 * Format number as Indian currency (with commas)
 * e.g., 1234567.89 -> "12,34,567.89"
 */
export function formatIndianCurrency(num: number): string {
  const [intPart, decPart] = num.toFixed(2).split('.')

  // Apply Indian comma grouping
  let result = ''
  const digits = intPart.split('').reverse()

  for (let i = 0; i < digits.length; i++) {
    if (i === 3) {
      result = ',' + result
    } else if (i > 3 && (i - 3) % 2 === 0) {
      result = ',' + result
    }
    result = digits[i] + result
  }

  return result + '.' + decPart
}

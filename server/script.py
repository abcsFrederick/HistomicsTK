import os
import numpy as np
import PIL

import histomicstk as htk

# Read Input Image
OAinputImage = np.array(PIL.Image.open(inputImageFile))

# Perform color deconvolution
W = np.array([[0.650, 0.072, 0], [0.704, 0.990, 0], [0.286, 0.105, 0]])
res = htk.ColorDeconvolution(inputImage, W)

# write stain images to output
outFileSuffix = os.path.split(inputImageFile)[1]

outputStainImageFile_1 = os.path.join(_tempdir, 'stain_1_' + outFileSuffix)
PIL.Image.fromarray(res.Stains[:, :, 0]).save(outputStainImageFile_1)

outputStainImageFile_2 = os.path.join(_tempdir, 'stain_2_' + outFileSuffix)
PIL.Image.fromarray(res.Stains[:, :, 1]).save(outputStainImageFile_2)

outputStainImageFile_3 = os.path.join(_tempdir, 'stain_3_' + outFileSuffix)
PIL.Image.fromarray(res.Stains[:, :, 2]).save(outputStainImageFile_3)
 
